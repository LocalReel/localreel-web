import { useCallback, useEffect, useRef, useState } from 'react'
import {
  displayTitle,
  fetchMedia,
  fetchState,
  formatDuration,
  preparePlayback,
  saveState,
  thumbnailUrl,
  type Media,
  type Playback,
} from './api'
import { resumeTarget } from './resume'

export default function Reels() {
  const [items, setItems] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const scroller = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.body.classList.add('reels-open')
    let cancelled = false
    fetchMedia({ limit: 60 })
      .then(page => {
        if (!cancelled) setItems(page.items)
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      document.body.classList.remove('reels-open')
    }
  }, [])

  const onScroll = useCallback(() => {
    const element = scroller.current
    if (!element || element.clientHeight === 0) return
    const index = Math.round(element.scrollTop / element.clientHeight)
    const clamped = Math.max(0, Math.min(items.length - 1, index))
    setActive(previous => (previous === clamped ? previous : clamped))
  }, [items.length])

  return (
    <div className="reels" ref={scroller} onScroll={onScroll}>
      <a className="reels-back" href="/">
        ← Library
      </a>
      {loading && <div className="reels-empty">Loading reels…</div>}
      {error && <div className="reels-empty error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="reels-empty">No media yet. Scan a source first.</div>
      )}
      {items.map((media, index) => (
        <ReelSlide key={media.id} media={media} active={index === active} />
      ))}
    </div>
  )
}

function ReelSlide({ media, active }: { media: Media; active: boolean }) {
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const lastSave = useRef(0)
  const resumeApplied = useRef(false)
  const resumePending = useRef(true)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    resumeApplied.current = false
    resumePending.current = true
    fetchState(media.id)
      .then(state => {
        if (cancelled) return
        const duration = state.duration || media.duration || 0
        const target = resumeTarget(state.position, duration)
        if (target !== null) {
          setResumeAt(target)
        } else {
          setResumeAt(null)
          resumePending.current = false
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResumeAt(null)
          resumePending.current = false
        }
      })
    return () => {
      cancelled = true
    }
  }, [active, media.duration, media.id])

  const save = useCallback(
    (position: number, duration: number) => {
      if (resumePending.current) return
      if (!Number.isFinite(position) || position <= 0) return
      void saveState(media.id, {
        position,
        duration: Number.isFinite(duration) && duration > 0 ? duration : (media.duration ?? 0),
      }).catch(() => {
        // Progress is best-effort; playback must not block on it.
      })
    },
    [media.duration, media.id],
  )

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let timer: number | undefined
    setError(null)
    setPlayback(null)

    const resolve = async () => {
      try {
        const next = await preparePlayback(media.id)
        if (cancelled) return
        setPlayback(next)
        if (next.mode === 'preparing') {
          timer = window.setTimeout(() => void resolve(), 1500)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      }
    }

    void resolve()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      const element = video.current
      if (element) {
        element.pause()
        save(element.currentTime, element.duration)
      }
    }
  }, [active, media.id, save])

  useEffect(() => {
    if (!active || !playback?.url) return
    const element = video.current
    if (!element) return
    element.muted = muted
    void element.play().catch(() => {
      // Autoplay can be blocked; the user can press play.
    })
    return () => {
      element.pause()
    }
  }, [active, muted, playback?.url])

  const applyResume = useCallback(() => {
    const element = video.current
    if (!element || resumeApplied.current || !resumeAt || element.readyState < 1) return
    const duration = Number.isFinite(element.duration) ? element.duration : 0
    const target = resumeTarget(resumeAt, duration)
    if (target === null) {
      resumePending.current = false
      return
    }
    element.currentTime = target
    resumeApplied.current = true
    resumePending.current = false
  }, [resumeAt])

  useEffect(() => {
    if (!active) return
    applyResume()
  }, [active, applyResume, playback?.url])

  const url =
    playback?.mode === 'direct' || playback?.mode === 'ready'
      ? playback.url
      : undefined
  const poster = thumbnailUrl(media) ?? undefined

  const togglePlay = () => {
    const element = video.current
    if (!element) return
    if (element.paused) {
      void element.play()
    } else {
      element.pause()
    }
  }

  return (
    <section className={`reel${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="reel-stage">
        {url ? (
          <video
            ref={video}
            src={url}
            poster={poster}
            playsInline
            muted={muted}
            preload="metadata"
            onClick={togglePlay}
            onLoadedMetadata={applyResume}
            onPause={event =>
              save(event.currentTarget.currentTime, event.currentTarget.duration)
            }
            onTimeUpdate={event => {
              if (Date.now() - lastSave.current < 5000) return
              lastSave.current = Date.now()
              save(event.currentTarget.currentTime, event.currentTarget.duration)
            }}
            onError={() => setError('Unable to play this file.')}
          />
        ) : (
          <div className="reel-status">
            {error ?? playback?.message ?? 'Preparing playback…'}
          </div>
        )}
      </div>

      <div className="reel-overlay">
        <p className="reel-kicker">Reel · {formatDuration(media.duration)}</p>
        <h2>{displayTitle(media)}</h2>
        <p className="reel-meta">
          {media.video_codec ?? 'unknown'}
          {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
          {active ? ' · playing' : ''}
        </p>
        <div className="reel-actions">
          <button type="button" className="reel-button" onClick={() => setMuted(m => !m)}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <a className="reel-button" href="/">
            Library
          </a>
        </div>
      </div>
    </section>
  )
}
