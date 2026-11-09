import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { navigate, Link } from '../../app/router'
import { fetchFeed, fetchMediaDetail, fetchPreviewVtt, thumbnailUrl } from '../../data/client'
import { useQuery } from '../../data/hooks'
import { useT } from '../../i18n'
import { formatDuration } from '../../lib/format'
import { parsePreviewVtt, cueAt, cueStyle, ratioOf } from '../../lib/preview'
import { episodeHeading } from '../../lib/text'
import { resumeTarget } from '../../lib/resume'
import { Button } from '../../ui/Button'
import { Menu, MenuItem, MenuLabel, MenuHint } from '../../ui/Menu'
import { Icon } from '../../ui/Icons'
import { Spinner } from '../../ui/Spinner'
import { usePlayback } from '../player/usePlayback'
import { useSavedState } from '../player/useSavedState'
import { useVideoElement } from '../player/useVideoElement'
import styles from './Watch.module.css'

export function WatchPage({ id }: { id: string }) {
  const mediaId = Number(id)
  const t = useT()
  const [audio, setAudio] = useState<number | null>(null)
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const seeded = useRef(false)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const playback = usePlayback(mediaId, { audio })
  const saved = useSavedState(mediaId)
  const detail = useQuery(`detail:${mediaId}`, () => fetchMediaDetail(mediaId), { staleTime: 60_000 })
  const feed = useQuery('feed:200', () => fetchFeed(200), { staleTime: 30_000 })
  const previewText = useQuery(
    `preview:${mediaId}`,
    () => fetchPreviewVtt(mediaId).then(text => (text ? parsePreviewVtt(text) : null)),
    { staleTime: 300_000 },
  )
  const preview = previewText.data ?? null

  const savedPosition = saved.state?.position ?? 0
  const savedDuration = saved.state?.duration ?? detail.data?.duration ?? 0

  // Seed the first seek from the stored position, once.
  useEffect(() => {
    if (seeded.current) return
    if (!saved.state) return
    seeded.current = true
    setResumeAt(resumeTarget(saved.state.position, saved.state.duration || savedDuration))
  }, [saved.state, savedDuration])

  const feedItem = useMemo(
    () => feed.data?.items.find(item => item.id === mediaId),
    [feed.data, mediaId],
  )
  const nextId = feedItem?.next_id ?? null

  const goNext = useCallback(() => {
    if (nextId) navigate(`/watch/${nextId}`)
  }, [nextId])

  const video = useVideoElement({
    playback: playback.status === 'ready' ? playback.playback : null,
    startAt: resumeAt,
    muted,
    onProgress: (position, duration) => {
      if (position > 0) saved.save({ position, duration })
    },
    onFlush: (position, duration) => saved.flush(position, duration),
    onEnded: goNext,
  })

  const ready = playback.status === 'ready' && Boolean(playback.playback?.url)
  const failed = playback.status === 'failed'
  const preparing = playback.status === 'preparing'

  const showControls = () => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (!video.state.playing) return
      setControlsVisible(false)
    }, 3200)
  }

  // Keyboard: the surface is a player, so the usual shortcuts apply.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault()
        video.toggle()
        showControls()
      } else if (event.key === 'ArrowRight') {
        video.seek(video.state.currentTime + 10)
      } else if (event.key === 'ArrowLeft') {
        video.seek(video.state.currentTime - 10)
      } else if (event.key === 'm') {
        setMuted(value => !value)
      } else if (event.key === 'f') {
        video.requestFullscreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const chooseAudio = (trackId: number | null) => {
    const current = video.videoRef.current?.currentTime
    if (current && current > 1) setResumeAt(current)
    setAudio(trackId)
  }

  const duration = video.state.duration || savedDuration || detail.data?.duration || 0
  const position = video.state.currentTime || savedPosition
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0
  const bufferedRatio = duration > 0 ? Math.min(1, video.state.buffered / duration) : 0

  const heading =
    detail.data?.metadata?.title ??
    (detail.data ? episodeHeading(detail.data, t) : `#${mediaId}`)

  const onBarPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const value = ratioOf(event.clientX, rect.left, rect.width)
    if (duration <= 0) return
    video.seek(value * duration)
  }

  return (
    <div className={styles.stage}>
      <header className={styles.top}>
        <Link to="/library" className={styles.backButton} aria-label={t('player.back')}>
          <Icon name="chevron-left" size={16} />
          {t('reels.backToLibrary')}
        </Link>
        <div className={styles.topSpacer} />
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.circleButton}
            aria-pressed={saved.state?.liked ?? false}
            aria-label={t(saved.state?.liked ? 'player.liked' : 'player.like')}
            title={t(saved.state?.liked ? 'player.liked' : 'player.like')}
            onClick={saved.toggleLike}
          >
            <Icon name="heart" size={18} />
          </button>
          <button
            type="button"
            className={styles.circleButton}
            aria-pressed={saved.state?.favorite ?? false}
            aria-label={t(saved.state?.favorite ? 'player.favorited' : 'player.favorite')}
            title={t(saved.state?.favorite ? 'player.favorited' : 'player.favorite')}
            onClick={saved.toggleFavorite}
          >
            <Icon name="bookmark" size={18} />
          </button>
        </div>
      </header>

      <div
        ref={frameRef}
        className={styles.frame}
        onPointerMove={showControls}
        onPointerLeave={() => setHoverRatio(null)}
      >
        {ready ? (
          <video
            ref={video.videoRef}
            className={styles.video}
            poster={detail.data ? (thumbnailUrl(detail.data) ?? undefined) : undefined}
            playsInline
            autoPlay
            onClick={() => {
              video.toggle()
              showControls()
            }}
            onDoubleClick={video.requestFullscreen}
          />
        ) : null}

        {!ready ? (
          <div className={styles.status} role="status">
            {failed ? (
              <>
                <p className={styles.statusTitle}>
                  {playback.error?.message === 'busy' ? t('player.error.busy') : t('player.failed')}
                </p>
                {playback.error && playback.error.message !== 'busy' ? (
                  <p className={styles.statusBody}>{playback.error.message}</p>
                ) : null}
                {playback.error?.detail ? (
                  <details className={styles.details}>
                    <summary>{t('common.details')}</summary>
                    <pre>{playback.error.detail}</pre>
                  </details>
                ) : null}
                <Button variant="secondary" icon="refresh" onClick={playback.retry}>
                  {t('player.retry')}
                </Button>
              </>
            ) : (
              <>
                <Spinner large />
                <p className={styles.statusBody}>
                  {preparing && playback.playback?.message === 'waiting for a transcode slot'
                    ? t('player.queued')
                    : t('player.preparing')}
                </p>
                {audio != null ? <p className={styles.sub}>{t('player.audioHint')}</p> : null}
              </>
            )}
          </div>
        ) : null}

        {ready ? (
          <div
            className={controlsVisible ? styles.controls : `${styles.controls} ${styles.controlsHidden}`}
          >
            <div
              className={styles.bar}
              data-scrubbing={scrubbing}
              role="slider"
              tabIndex={0}
              aria-label={t('player.play')}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(position)}
              aria-valuetext={`${formatDuration(position)} / ${formatDuration(duration)}`}
              onPointerMove={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                setHoverRatio(ratioOf(event.clientX, rect.left, rect.width))
              }}
              onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setScrubbing(true)
                onBarPointer(event)
              }}
              onPointerMoveCapture={event => {
                if (!scrubbing) return
                onBarPointer(event)
              }}
              onPointerUp={() => setScrubbing(false)}
              onPointerLeave={() => setHoverRatio(null)}
              onKeyDown={event => {
                if (event.key === 'ArrowRight') video.seek(position + 5)
                if (event.key === 'ArrowLeft') video.seek(position - 5)
              }}
            >
              <div className={styles.barTrack}>
                <div className={styles.barBuffered} style={{ width: `${bufferedRatio * 100}%` }} />
                <div className={styles.barFill} style={{ width: `${ratio * 100}%` }} />
              </div>
              <span className={styles.barThumb} style={{ left: `${ratio * 100}%` }} aria-hidden="true" />
              {preview && hoverRatio != null && duration > 0
                ? (() => {
                    const cue = cueAt(preview, hoverRatio * duration)
                    if (!cue) return null
                    return (
                      <div
                        className={styles.preview}
                        style={{ left: `${hoverRatio * 100}%` }}
                        aria-hidden="true"
                      >
                        <div className={styles.previewImage} style={cueStyle(preview, cue)} />
                        <p className={styles.previewTime}>{formatDuration(hoverRatio * duration)}</p>
                      </div>
                    )
                  })()
                : null}
            </div>

            <div className={styles.row}>
              <button
                type="button"
                className={styles.controlButton}
                onClick={video.toggle}
                aria-label={t(video.state.playing ? 'player.pause' : 'player.play')}
              >
                <Icon name={video.state.playing ? 'pause' : 'play'} size={20} />
              </button>
              <span className={styles.time}>
                {formatDuration(position)} / {formatDuration(duration)}
              </span>
              <span className={styles.grow} />

              <Menu
                label={t('player.audio')}
                icon="list"
                className={styles.controlButton}
                align="right"
              >
                <MenuLabel>{t('player.audio')}</MenuLabel>
                <MenuItem checked={audio == null} onClick={() => chooseAudio(null)}>
                  {t('player.audioDefault')}
                </MenuItem>
                {playback.tracks.map(track => (
                  <MenuItem
                    key={track.id}
                    checked={audio === track.id}
                    onClick={() => chooseAudio(track.id)}
                  >
                    {[track.language, track.title].filter(Boolean).join(' · ') || `#${track.id}`}
                  </MenuItem>
                ))}
                <MenuHint>{t('player.audioHint')}</MenuHint>
              </Menu>

              <button
                type="button"
                className={styles.textButton}
                aria-pressed={playback.hls}
                disabled={playback.hls}
                onClick={playback.switchToHls}
                title={t('player.hlsHint')}
              >
                {t(playback.hls ? 'player.hlsActive' : 'player.hls')}
              </button>

              <button
                type="button"
                className={styles.textButton}
                disabled
                title={t('player.subtitlesSoon')}
              >
                {t('player.subtitles')}
              </button>

              <button
                type="button"
                className={styles.controlButton}
                onClick={() => setMuted(value => !value)}
                aria-label={t(muted ? 'player.unmute' : 'player.mute')}
              >
                <Icon name={muted ? 'mute' : 'volume'} size={18} />
              </button>
              <button
                type="button"
                className={styles.controlButton}
                onClick={video.requestFullscreen}
                aria-label={t('player.fullscreen')}
              >
                <Icon name="expand" size={18} />
              </button>
              {nextId ? (
                <button
                  type="button"
                  className={styles.controlButton}
                  onClick={goNext}
                  aria-label={t('player.next')}
                  title={t('player.next')}
                >
                  <Icon name="chevron-right" size={20} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <section className={styles.meta}>
        <h1 className={styles.title}>{heading}</h1>
        <p className={styles.sub}>
          {[
            detail.data?.video_codec,
            detail.data?.width && detail.data?.height
              ? `${detail.data.width}×${detail.data.height}`
              : null,
            formatDuration(duration),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {detail.data?.metadata?.overview ? (
          <p className={styles.overview}>{detail.data.metadata.overview}</p>
        ) : null}
        <div className={styles.metaActions}>
          {nextId ? (
            <Button variant="primary" iconAfter="chevron-right" onClick={goNext}>
              {t('player.next')}
            </Button>
          ) : (
            <Button variant="ghost" disabled>
              {t('player.noNext')}
            </Button>
          )}
          <Link to="/reels">
            <Button variant="secondary" icon="reels">
              {t('home.reelsCta')}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
