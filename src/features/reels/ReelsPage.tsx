import { useCallback, useEffect, useRef, useState } from 'react'

import { Link } from '../../app/router'
import { fetchFeed, thumbnailUrlOf } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { FeedItem } from '../../data/types'
import { useT } from '../../i18n'
import { formatDuration, watchedPercent } from '../../lib/format'
import { inSpeedZone, isLandscape, objectFitForFeedItem } from '../../lib/feed'
import { episodeHeading } from '../../lib/text'
import { resumeTarget } from '../../lib/resume'
import { Icon } from '../../ui/Icons'
import { Spinner } from '../../ui/Spinner'
import { usePlayback } from '../player/usePlayback'
import { useSavedState } from '../player/useSavedState'
import { useVideoElement } from '../player/useVideoElement'
import styles from './Reels.module.css'

const PRELOAD_DISTANCE = 1
const LONG_PRESS_MS = 480
const DOUBLE_TAP_MS = 300
const TAP_SLOP_PX = 12

/**
 * The vertical feed.
 *
 * One card per slide, but only the active slide and its immediate neighbours
 * mount a `<video>` (each one asks the server how to play, so mounting all of
 * them would fire hundreds of prepare requests). Scrolling itself is native
 * CSS scroll-snap; the gestures below only cover tap, double tap and hold.
 */
export function ReelsPage() {
  const t = useT()
  const feed = useQuery('feed:200', () => fetchFeed(200), { staleTime: 30_000 })
  const scroller = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [ended, setEnded] = useState(false)
  const items = feed.data?.items ?? []

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const index = Math.round(element.scrollTop / Math.max(1, element.clientHeight))
        setActive(Math.max(0, Math.min(items.length - 1, index)))
      })
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [items.length])

  const goTo = useCallback((index: number) => {
    const element = scroller.current
    if (!element) return
    element.scrollTo({ top: index * element.clientHeight, behavior: 'smooth' })
  }, [])

  const advance = useCallback(
    (currentIndex: number) => {
      const item = items[currentIndex]
      if (!item) return false
      if (item.next_id == null) return false
      const nextIndex = items.findIndex(entry => entry.id === item.next_id)
      if (nextIndex < 0) return false
      goTo(nextIndex)
      return true
    },
    [goTo, items],
  )

  if (feed.loading && !feed.data) {
    return (
      <div className={styles.empty}>
        <Spinner large />
        <p>{t('common.loading')}</p>
      </div>
    )
  }

  if (feed.error) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('reels.error')}</p>
        <p>{feed.error instanceof Error ? feed.error.message : String(feed.error)}</p>
        <button type="button" className={styles.back} onClick={() => feed.reload()}>
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('reels.empty.title')}</p>
        <p>{t('reels.empty.body')}</p>
        <Link to="/library" className={styles.back}>
          {t('reels.backToLibrary')}
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className={styles.top}>
        <Link to="/library" className={styles.back}>
          <Icon name="chevron-left" size={15} />
          {t('reels.backToLibrary')}
        </Link>
        <button
          type="button"
          className={styles.back}
          onClick={() => setMuted(value => !value)}
          aria-pressed={muted}
          aria-label={t(muted ? 'player.unmute' : 'player.mute')}
        >
          <Icon name={muted ? 'mute' : 'volume'} size={16} />
        </button>
      </div>

      <div className={styles.feed} ref={scroller}>
        {items.map((item, index) => {
          const near = Math.abs(index - active) <= PRELOAD_DISTANCE
          return near ? (
            <ReelCard
              key={item.id}
              item={item}
              index={index}
              active={index === active}
              muted={muted}
              onMute={setMuted}
              onEnded={() => {
                if (!advance(index)) setEnded(true)
              }}
              onEndedReset={() => setEnded(false)}
              ended={ended && index === active}
            />
          ) : (
            <div key={item.id} className={styles.slide}>
              <Poster item={item} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function Poster({ item }: { item: FeedItem }) {
  const poster = thumbnailUrlOf(item.thumbnail_path)
  return poster ? (
    <div className={styles.poster}>
      <img src={poster} alt="" loading="lazy" />
    </div>
  ) : null
}

function ReelCard({
  item,
  index,
  active,
  muted,
  onMute,
  onEnded,
  onEndedReset,
  ended,
}: {
  item: FeedItem
  index: number
  active: boolean
  muted: boolean
  onMute: (muted: boolean) => void
  onEnded: () => void
  onEndedReset: () => void
  ended: boolean
}) {
  const t = useT()
  const saved = useSavedState(item.id)
  const playback = usePlayback(item.id)
  const [speed, setSpeed] = useState(false)
  const [burst, setBurst] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const slideRef = useRef<HTMLElement | null>(null)

  const startAt = resumeTarget(item.position, item.duration)
  const ready = playback.status === 'ready' && Boolean(playback.playback?.url)

  const video = useVideoElement({
    playback: ready ? playback.playback : null,
    startAt,
    muted,
    onProgress: (position, duration) => saved.save({ position, duration }),
    onFlush: (position, duration) => saved.flush(position, duration),
    onEnded,
  })

  // Only the active slide plays; the neighbours stay paused and ready.
  useEffect(() => {
    if (!ready) return
    if (active) video.play()
    else video.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready])

  useEffect(() => {
    onEndedReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const press = useRef<{ x: number; y: number; long: boolean } | null>(null)
  const longTimer = useRef<number | null>(null)
  const lastTap = useRef(0)

  const clearLong = () => {
    if (longTimer.current) window.clearTimeout(longTimer.current)
    longTimer.current = null
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    press.current = { x: event.clientX, y: event.clientY, long: false }
    const rect = event.currentTarget.getBoundingClientRect()
    if (inSpeedZone(event.clientX, rect)) {
      longTimer.current = window.setTimeout(() => {
        if (!press.current) return
        press.current.long = true
        video.setRate(2)
        setSpeed(true)
      }, LONG_PRESS_MS)
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!press.current || press.current.long) return
    if (
      Math.abs(event.clientX - press.current.x) > TAP_SLOP_PX ||
      Math.abs(event.clientY - press.current.y) > TAP_SLOP_PX
    ) {
      clearLong()
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    clearLong()
    const started = press.current
    press.current = null
    if (!started) return
    if (started.long) {
      video.setRate(1)
      setSpeed(false)
      return
    }
    if (
      Math.abs(event.clientX - started.x) > TAP_SLOP_PX ||
      Math.abs(event.clientY - started.y) > TAP_SLOP_PX
    ) {
      return
    }

    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      saved.toggleLike()
      setBurst(value => value + 1)
      return
    }
    lastTap.current = now
    window.setTimeout(() => {
      if (lastTap.current === now) video.toggle()
    }, 260)
  }

  const duration = video.state.duration || item.duration
  const position = video.state.currentTime || item.position
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0
  const fit = objectFitForFeedItem(item)
  const poster = thumbnailUrlOf(item.thumbnail_path)
  const heading = item.series_title ?? episodeHeading(item, t)

  return (
    <section className={styles.slide} aria-label={heading} ref={slideRef}>
      {poster ? (
        <div className={styles.backdrop} style={{ backgroundImage: `url("${poster}")` }} aria-hidden="true" />
      ) : null}
      <video
        ref={video.videoRef}
        className={`${styles.video} ${fit === 'cover' ? styles.cover : styles.contain}`}
        playsInline
        muted={muted}
        autoPlay={active}
      />

      <div
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          clearLong()
          press.current = null
          video.setRate(1)
          setSpeed(false)
        }}
        onContextMenu={event => event.preventDefault()}
      />

      {!ready ? (
        <div className={styles.status} role="status">
          {playback.status === 'failed' ? (
            <>
              <p className={styles.statusTitle}>{t('player.failed')}</p>
              {playback.error?.message && playback.error.message !== 'busy' ? (
                <p>{playback.error.message}</p>
              ) : null}
            </>
          ) : (
            <>
              <Spinner large />
              <p>{t('player.preparing')}</p>
            </>
          )}
        </div>
      ) : null}

      {speed ? <span className={styles.badge}>{t('player.speed')}</span> : null}

      {isLandscape(item.width, item.height) ? (
        <button
          type="button"
          className={styles.fullscreenPill}
          onClick={() => {
            void slideRef.current?.requestFullscreen?.().catch(() => {})
          }}
        >
          <Icon name="expand" size={13} />
          {t('reels.fullscreen')}
        </button>
      ) : null}

      {burst > 0 ? (
        <span key={burst} className={styles.burst} aria-hidden="true">
          <Icon name="heart" size={96} />
        </span>
      ) : null}

      <div className={styles.overlay}>
        <div className={styles.info}>
          <p className={styles.series}>{heading}</p>
          {item.episode != null ? (
            <p className={styles.episode}>{t('library.episode', { number: item.episode })}</p>
          ) : null}
          <p className={styles.meta}>
            <span>{formatDuration(item.duration)}</span>
            {item.position > 0 ? (
              <span>{t('library.progress', { percent: watchedPercent(item.position, item.duration) })}</span>
            ) : null}
          </p>
        </div>

        <div className={styles.rail}>
          <button
            type="button"
            className={styles.action}
            aria-pressed={saved.state?.liked ?? false}
            onClick={saved.toggleLike}
          >
            <Icon name="heart" size={26} />
            <span>{t(saved.state?.liked ? 'player.liked' : 'player.like')}</span>
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={saved.state?.favorite ?? false}
            onClick={saved.toggleFavorite}
          >
            <Icon name="bookmark" size={24} />
            <span>{t(saved.state?.favorite ? 'player.favorited' : 'player.favorite')}</span>
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={muted}
            onClick={() => onMute(!muted)}
          >
            <Icon name={muted ? 'mute' : 'volume'} size={24} />
            <span>{t(muted ? 'player.unmute' : 'player.mute')}</span>
          </button>
        </div>
      </div>

      <div
        className={styles.progress}
        onPointerDown={event => {
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          setScrubbing(true)
          const rect = event.currentTarget.getBoundingClientRect()
          if (duration > 0) video.seek(((event.clientX - rect.left) / rect.width) * duration)
        }}
        onPointerMove={event => {
          if (!scrubbing || duration <= 0) return
          const rect = event.currentTarget.getBoundingClientRect()
          const value = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
          video.seek(value * duration)
        }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
      >
        <div className={styles.timeRow}>
          <span>{formatDuration(position)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <div className={styles.track}>
          <span className={styles.fill} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>

      {ended ? (
        <div className={styles.ended} role="status">
          <p className={styles.statusTitle}>{t('reels.ended')}</p>
          <button
            type="button"
            className={styles.back}
            onClick={() => {
              onEndedReset()
              video.seek(0)
              video.play()
            }}
          >
            {t('reels.replay')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
