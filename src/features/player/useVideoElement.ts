import { useCallback, useEffect, useRef, useState } from 'react'

import type { Playback } from '../../data/types'

export interface VideoState {
  currentTime: number
  duration: number
  buffered: number
  playing: boolean
  ended: boolean
  failed: boolean
}

export interface UseVideoOptions {
  playback: Playback | null
  /** Seconds to seek to once metadata is known; null for "from the start". */
  startAt: number | null
  onProgress?: (position: number, duration: number) => void
  /** Called when the page is going away or the player unmounts. */
  onFlush?: (position: number, duration: number) => void
  onEnded?: () => void
  muted?: boolean
  autoPlay?: boolean
  /** Throttle for `onProgress`; the server stores at most one write per 5s. */
  saveEveryMs?: number
}

const DEFAULT_SAVE_EVERY = 5000

/**
 * The one place a `<video>` element is driven.
 *
 * Owns source attachment (native HLS or hls.js), resume-once semantics, the
 * throttled progress callback and the final flush when the page unloads. Both
 * the watch page and the vertical feed build on this so their playback rules
 * cannot drift apart again.
 */
export function useVideoElement(options: UseVideoOptions) {
  const {
    playback,
    startAt,
    onProgress,
    onFlush,
    onEnded,
    muted = false,
    autoPlay = true,
    saveEveryMs = DEFAULT_SAVE_EVERY,
  } = options

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [element, setElement] = useState<HTMLVideoElement | null>(null)
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setElement(node)
  }, [])
  const [state, setState] = useState<VideoState>({
    currentTime: 0,
    duration: 0,
    buffered: 0,
    playing: false,
    ended: false,
    failed: false,
  })

  const lastSave = useRef(0)
  const resumeApplied = useRef(false)
  const resumeValue = useRef(startAt)
  resumeValue.current = startAt
  // The element resets when the source is detached, so the last known position
  // is kept separately: a flush on unmount must not read `currentTime` after
  // the source has already been removed.
  const lastKnown = useRef({ position: 0, duration: 0 })
  const progressRef = useRef(onProgress)
  progressRef.current = onProgress
  const flushRef = useRef(onFlush)
  flushRef.current = onFlush
  const endedRef = useRef(onEnded)
  endedRef.current = onEnded

  const url = playback?.url ?? null
  const isHls = Boolean(url && /\.m3u8(\?|$)/i.test(url))

  // Attach the source. hls.js is loaded on demand so its 600 KB only arrives
  // for files that actually need repackaging.
  useEffect(() => {
    if (!element || !url) return
    resumeApplied.current = false
    setState(current => ({ ...current, failed: false, ended: false }))

    if (!isHls) {
      element.src = url
      return () => {
        element.removeAttribute('src')
        element.load()
      }
    }

    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = url
      return () => {
        element.removeAttribute('src')
        element.load()
      }
    }

    let disposed = false
    let instance: import('hls.js').default | null = null
    void import('hls.js')
      .then(module => {
        if (disposed) return
        const Hls = module.default
        if (!Hls.isSupported()) {
          setState(current => ({ ...current, failed: true }))
          return
        }
        instance = new Hls({ enableWorker: true })
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!disposed && data.fatal) setState(current => ({ ...current, failed: true }))
        })
        instance.loadSource(url)
        instance.attachMedia(element)
      })
      .catch(() => {
        if (!disposed) setState(current => ({ ...current, failed: true }))
      })

    return () => {
      disposed = true
      instance?.destroy()
      element.removeAttribute('src')
      element.load()
    }
  }, [element, isHls, url])

  // Resume exactly once per source, as soon as metadata allows a seek.
  const applyResume = useCallback(() => {
    const element = videoRef.current
    if (!element || resumeApplied.current) return
    const target = resumeValue.current
    if (target == null) return
    if (element.readyState < 1 || !Number.isFinite(element.duration) || element.duration <= 0) return
    element.currentTime = Math.min(target, Math.max(0, element.duration - 5))
    resumeApplied.current = true
  }, [])

  useEffect(() => {
    if (!element) return

    const flush = () => {
      const { position, duration } = lastKnown.current
      if (!Number.isFinite(position) || position <= 0) return
      flushRef.current?.(position, duration)
    }

    const onTime = () => {
      const duration = Number.isFinite(element.duration) ? element.duration : 0
      const buffered = element.buffered.length > 0 ? element.buffered.end(element.buffered.length - 1) : 0
      lastKnown.current = { position: element.currentTime, duration }
      setState(current => ({
        ...current,
        currentTime: element.currentTime,
        duration,
        buffered,
        playing: !element.paused,
      }))
      if (Date.now() - lastSave.current < saveEveryMs) return
      lastSave.current = Date.now()
      progressRef.current?.(element.currentTime, duration)
    }

    const onPlay = () => setState(current => ({ ...current, playing: true, ended: false }))
    const onPause = () => {
      setState(current => ({ ...current, playing: false }))
      flush()
    }
    const onEndedEvent = () => {
      setState(current => ({ ...current, playing: false, ended: true }))
      const duration = Number.isFinite(element.duration) ? element.duration : 0
      // Writing `duration` as the position is what marks an item finished.
      progressRef.current?.(duration, duration)
      endedRef.current?.()
    }
    const onError = () => setState(current => ({ ...current, failed: true }))
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    element.addEventListener('timeupdate', onTime)
    element.addEventListener('play', onPlay)
    element.addEventListener('pause', onPause)
    element.addEventListener('ended', onEndedEvent)
    element.addEventListener('error', onError)
    element.addEventListener('loadedmetadata', applyResume)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)

    return () => {
      element.removeEventListener('timeupdate', onTime)
      element.removeEventListener('play', onPlay)
      element.removeEventListener('pause', onPause)
      element.removeEventListener('ended', onEndedEvent)
      element.removeEventListener('error', onError)
      element.removeEventListener('loadedmetadata', applyResume)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [applyResume, element, saveEveryMs])

  // A saved position can arrive after metadata; apply it when it does.
  useEffect(() => {
    applyResume()
  }, [applyResume, startAt, url])

  useEffect(() => {
    const element = videoRef.current
    if (element) element.muted = muted
  }, [element, muted])

  const play = useCallback(() => {
    void videoRef.current?.play().catch(() => {
      // Autoplay can be blocked; the poster and the play button remain.
    })
  }, [])

  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [])

  const toggle = useCallback(() => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) play()
    else pause()
  }, [pause, play])

  const seek = useCallback((seconds: number) => {
    const element = videoRef.current
    if (!element || !Number.isFinite(seconds)) return
    const clamped = Math.max(0, Math.min(seconds, Number.isFinite(element.duration) ? element.duration : seconds))
    element.currentTime = clamped
    setState(current => ({ ...current, currentTime: clamped }))
  }, [])

  const setRate = useCallback((rate: number) => {
    const element = videoRef.current
    if (element) element.playbackRate = rate
  }, [])

  const setVolume = useCallback((volume: number) => {
    const element = videoRef.current
    if (element) element.volume = Math.max(0, Math.min(1, volume))
  }, [])

  const requestFullscreen = useCallback(() => {
    const element = videoRef.current
    const target = element?.parentElement ?? element
    void target?.requestFullscreen?.().catch(() => {})
  }, [])

  return {
    attachVideo,
    videoRef,
    state,
    play,
    pause,
    toggle,
    seek,
    setRate,
    setVolume,
    requestFullscreen,
    isHls,
    autoPlay,
  }
}
