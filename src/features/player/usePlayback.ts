import { useCallback, useEffect, useState } from 'react'

import { ApiError, describeError, fetchTracks, preparePlayback } from '../../data/client'
import type { Playback, Track } from '../../data/types'

export type PlaybackStatus = 'preparing' | 'ready' | 'failed'

export interface PlaybackState {
  status: PlaybackStatus
  playback: Playback | null
  tracks: Track[]
  /** True when the current source is an HLS playlist. */
  hls: boolean
  error: { message: string; detail?: string } | null
  /** Restart from the top: used by "try direct play" after a failure. */
  retry: () => void
  /** Ask the server to repackage as HLS. */
  switchToHls: () => void
}

const POLL_MS = 1500
const MAX_POLLS = 80

/**
 * Resolve how to play one file, and keep polling while the server prepares it.
 *
 * The server answers `preparing` (202) while a transcode runs, `404` with a
 * failed body when the file is gone, and `503 busy` under memory pressure. All
 * three are normal outcomes a player has to render, not exceptions.
 */
export function usePlayback(mediaId: number, options: { audio?: number | null } = {}): PlaybackState {
  const audio = options.audio ?? null
  const [attempt, setAttempt] = useState(0)
  const [forceHls, setForceHls] = useState(false)
  const [status, setStatus] = useState<PlaybackStatus>('preparing')
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    let polls = 0

    setStatus('preparing')
    setError(null)
    setPlayback(null)

    const resolve = async () => {
      try {
        const next = await preparePlayback(mediaId, {
          format: forceHls ? 'hls' : undefined,
          audio,
        })
        if (cancelled) return

        if (next.mode === 'failed') {
          setStatus('failed')
          setPlayback(next)
          setError({ message: next.message ?? '', detail: next.detail })
          return
        }

        if (next.mode === 'preparing') {
          setStatus('preparing')
          setPlayback(next)
          polls += 1
          if (polls > MAX_POLLS) {
            setStatus('failed')
            setError({ message: next.message ?? 'preparing' })
            return
          }
          timer = window.setTimeout(() => void resolve(), POLL_MS)
          return
        }

        setPlayback(next)
        setStatus('ready')
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 503) {
          setStatus('failed')
          setError({ message: 'busy' })
          return
        }
        const parts = describeError(cause)
        setStatus('failed')
        setError(parts)
      }
    }

    void resolve()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [audio, attempt, forceHls, mediaId])

  useEffect(() => {
    let stopped = false
    fetchTracks(mediaId)
      .then(list => {
        if (!stopped) setTracks(list.filter(track => track.kind === 'audio'))
      })
      .catch(() => {
        if (!stopped) setTracks([])
      })
    return () => {
      stopped = true
    }
  }, [mediaId])

  const retry = useCallback(() => {
    setForceHls(false)
    setAttempt(value => value + 1)
  }, [])

  const switchToHls = useCallback(() => {
    setForceHls(true)
    setAttempt(value => value + 1)
  }, [])

  const hls = Boolean(playback?.url && /\.m3u8(\?|$)/i.test(playback.url))

  return { status, playback, tracks, hls, error, retry, switchToHls }
}

/** Poll interval exposed for tests of the calling surface. */
export const PLAYBACK_POLL_MS = POLL_MS
