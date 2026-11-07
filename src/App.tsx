import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Admin from './Admin'
import ErrorDetail from './ErrorDetail'
import LangSwitch from './LangSwitch'
import Reels from './Reels'
import TrackMenu from './TrackMenu'
import {
  describeError,
  displayTitle,
  fetchMedia,
  fetchState,
  fetchTracks,
  formatDuration,
  preparePlayback,
  saveState,
  thumbnailUrl,
  type Media,
  type MediaFilter,
  type MediaPage,
  type Playback,
  type Track,
} from './api'
import { useLang, type Translate, type TranslationKey } from './i18n'
import { resumeTarget } from './resume'

const filters: Array<{ id: MediaFilter; labelKey: TranslationKey }> = [
  { id: 'all', labelKey: 'library.filter.all' },
  { id: 'continue', labelKey: 'library.filter.continue' },
  { id: 'favorites', labelKey: 'library.filter.favorites' },
]

export default function App() {
  const path = window.location.pathname
  // Reels is a full-screen surface with its own overlay controls, so it
  // deliberately renders without the app chrome and bottom navigation.
  if (path.startsWith('/watch')) return <Reels />
  if (path.startsWith('/admin')) {
    return (
      <>
        <Admin />
        <MobileNav current="admin" />
      </>
    )
  }
  return (
    <>
      <Library />
      <MobileNav current="library" />
    </>
  )
}

type MobileTab = 'library' | 'reels' | 'admin'

const mobileTabs: Array<{ id: MobileTab; href: string; labelKey: TranslationKey }> = [
  { id: 'library', href: '/', labelKey: 'nav.tab.library' },
  { id: 'reels', href: '/watch', labelKey: 'nav.tab.reels' },
  { id: 'admin', href: '/admin', labelKey: 'nav.tab.admin' },
]

/**
 * Bottom tab bar for phones (media library / reels / admin). CSS hides it on
 * wide screens, so the desktop layout with the topbar navigation is untouched.
 */
function MobileNav({ current }: { current: Exclude<MobileTab, 'reels'> }) {
  const { t } = useLang()
  return (
    <nav className="mobile-nav" aria-label={t('nav.bottom')}>
      {mobileTabs.map(tab => (
        <a
          key={tab.id}
          href={tab.href}
          className={tab.id === current ? 'mobile-tab active' : 'mobile-tab'}
          aria-current={tab.id === current ? 'page' : undefined}
        >
          <span className="mobile-tab-icon" aria-hidden="true">
            {tab.id === 'library' ? (
              <LibraryIcon />
            ) : tab.id === 'reels' ? (
              <ReelsIcon />
            ) : (
              <AdminIcon />
            )}
          </span>
          <span>{t(tab.labelKey)}</span>
        </a>
      ))}
    </nav>
  )
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ReelsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 8.5v7l6-3.5Z" fill="currentColor" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function Library() {
  const { lang, setLang, t } = useLang()
  const [page, setPage] = useState<MediaPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [selected, setSelected] = useState<Media | null>(null)
  const requestId = useRef(0)

  const load = useCallback(
    async (offset = 0, append = false) => {
      const current = ++requestId.current
      setLoading(!append)
      setError(null)
      setErrorDetail(null)
      try {
        const next = await fetchMedia({
          q: query.trim() || undefined,
          filter,
          limit: 60,
          offset,
          includeArchived,
        })
        if (current !== requestId.current) return
        setPage(previous =>
          append && previous
            ? { ...next, items: [...previous.items, ...next.items] }
            : next,
        )
      } catch (cause) {
        if (current === requestId.current) {
          const parts = describeError(cause)
          setError(parts.message)
          setErrorDetail(parts.detail ?? null)
        }
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    },
    [filter, includeArchived, query],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(0, false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const items = page?.items ?? []
  const total = page?.total ?? 0
  const empty = !loading && !error && items.length === 0

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="kicker">{t('library.kicker')}</p>
          <h1>LocalReel</h1>
        </div>
        <div className="topbar-right" style={{ flexWrap: 'wrap', rowGap: '0.5rem' }}>
          <p className="count">
            {t(total === 1 ? 'library.count.one' : 'library.count.other', {
              count: total,
            })}
          </p>
          <a className="nav-link" href="/watch">
            {t('nav.reels')}
          </a>
          <a className="nav-link" href="/admin">
            {t('nav.admin')}
          </a>
          <LangSwitch lang={lang} onChange={setLang} t={t} />
        </div>
      </header>

      <section className="controls" aria-label={t('library.controls')}>
        <input
          className="search"
          type="search"
          value={query}
          placeholder={t('library.search')}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="filters" role="tablist" aria-label={t('library.filters')}>
          {filters.map(entry => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              className={filter === entry.id ? 'filter active' : 'filter'}
              onClick={() => setFilter(entry.id)}
            >
              {t(entry.labelKey)}
            </button>
          ))}
          <button
            type="button"
            className={includeArchived ? 'filter active' : 'filter'}
            title={t('library.filter.archived.title')}
            onClick={() => setIncludeArchived(value => !value)}
          >
            {t('library.filter.archived')}
          </button>
        </div>
      </section>

      {error && (
        <div className="notice error">
          <span>{error}</span>
          <ErrorDetail detail={errorDetail} t={t} />
        </div>
      )}
      {loading && !page && <div className="notice">{t('library.loading')}</div>}
      {empty && (
        <div className="notice">
          {t('library.empty.prefix')}
          <a className="nav-link" href="/admin">
            {t('admin.sources.title')}
          </a>
          {t('library.empty.suffix')}
        </div>
      )}

      <section className="grid">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className="card"
            onClick={() => setSelected(item)}
          >
            <div className="poster">
              {thumbnailUrl(item) ? (
                <img src={thumbnailUrl(item) ?? ''} alt="" loading="lazy" />
              ) : (
                <div className="placeholder">
                  {item.missing_at ? t('common.missing') : item.filename.split('.').pop()}
                </div>
              )}
              <span className="duration">{formatDuration(item.duration)}</span>
              {item.missing_at && <span className="badge">{t('common.missing')}</span>}
            </div>
            <div className="meta">
              <span className="title">{displayTitle(item)}</span>
              <span className="sub">
                {item.video_codec ?? t('common.unknownCodec')}
                {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
              </span>
            </div>
          </button>
        ))}
      </section>

      {page?.next_cursor != null && (
        <button
          type="button"
          className="more"
          disabled={loading}
          onClick={() => void load(page.next_cursor ?? 0, true)}
        >
          {loading ? t('library.loadingMore') : t('library.loadMore')}
        </button>
      )}

      {selected && (
        <Player media={selected} onClose={() => setSelected(null)} t={t} />
      )}
    </main>
  )
}

function Player({
  media,
  onClose,
  t,
}: {
  media: Media
  onClose: () => void
  t: Translate
}) {
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [playFailed, setPlayFailed] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [audioTrack, setAudioTrack] = useState<number | null>(null)
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const [hlsMode, setHlsMode] = useState(false)
  const cancelled = useRef(false)
  const video = useRef<HTMLVideoElement | null>(null)
  const lastSave = useRef(0)
  const resumeApplied = useRef(false)
  const resumePending = useRef(true)

  useEffect(() => {
    cancelled.current = false
    let timer: number | undefined

    const resolve = async () => {
      try {
        const next = await preparePlayback(media.id, {
          format: hlsMode ? 'hls' : undefined,
          audio: audioTrack,
        })
        if (cancelled.current) return
        setPlayback(next)
        if (next.mode === 'preparing') {
          timer = window.setTimeout(() => void resolve(), 1200)
        }
      } catch (cause) {
        if (!cancelled.current) {
          const parts = describeError(cause)
          setError(parts.message)
          setErrorDetail(parts.detail ?? null)
        }
      }
    }

    void resolve()
    return () => {
      cancelled.current = true
      if (timer) window.clearTimeout(timer)
    }
  }, [media.id, hlsMode, audioTrack])

  // The track list is per media and does not change while the player is open.
  useEffect(() => {
    let stopped = false
    fetchTracks(media.id)
      .then(list => {
        if (!stopped) setTracks(list)
      })
      .catch(() => {
        if (!stopped) setTracks([])
      })
    return () => {
      stopped = true
    }
  }, [media.id])

  useEffect(() => {
    let stopped = false
    resumeApplied.current = false
    resumePending.current = true
    fetchState(media.id)
      .then(state => {
        if (stopped) return
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
        if (!stopped) {
          setResumeAt(null)
          resumePending.current = false
        }
      })
    return () => {
      stopped = true
    }
  }, [media.duration, media.id])

  const saveProgress = useCallback(
    (position: number, duration: number) => {
      if (resumePending.current) return
      if (!Number.isFinite(position) || position <= 0) return
      void saveState(media.id, {
        position,
        duration:
          Number.isFinite(duration) && duration > 0 ? duration : (media.duration ?? 0),
      }).catch(() => {
        // best effort
      })
    },
    [media.duration, media.id],
  )

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
    applyResume()
  }, [applyResume, playback?.url])

  useEffect(() => {
    return () => {
      const element = video.current
      if (element) saveProgress(element.currentTime, element.duration)
    }
  }, [saveProgress])

  const direct = playback?.mode === 'direct' || playback?.mode === 'ready'
  const source = direct ? playback?.url : undefined
  const hlsSource = source && /\.m3u8($|\?)/i.test(source) ? source : undefined
  const poster = useMemo(() => thumbnailUrl(media) ?? undefined, [media])

  useEffect(() => {
    if (!hlsSource) return
    const element = video.current
    if (!element) return
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = hlsSource
      return
    }
    let disposed = false
    let instance: import('hls.js').default | null = null
    void import('hls.js').then(module => {
      if (disposed) return
      const Hls = module.default
      if (!Hls.isSupported()) {
        setError(t('player.hlsUnsupported'))
        setErrorDetail(null)
        return
      }
      instance = new Hls({ enableWorker: true })
      instance.loadSource(hlsSource)
      instance.attachMedia(element)
    })
    return () => {
      disposed = true
      instance?.destroy()
    }
    // `t` is stable for the language; the source is what changes playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsSource])

  const switchToHls = () => {
    if (hlsMode) return
    setPlayFailed(false)
    setError(null)
    setErrorDetail(null)
    setPlayback(null)
    setHlsMode(true)
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={displayTitle(media)}>
      <div className="player">
        <button
          type="button"
          className="close"
          onClick={onClose}
          aria-label={t('player.close')}
        >
          ×
        </button>
        <button
          type="button"
          className={hlsMode ? 'mode active' : 'mode'}
          onClick={switchToHls}
          disabled={hlsMode}
          title={t('player.hlsHint')}
        >
          {t('player.hls')}
        </button>
        <TrackMenu
          tracks={tracks}
          selected={audioTrack}
          onSelect={track => setAudioTrack(track.id)}
          t={t}
        />
        {source ? (
          <video
            key={source}
            ref={video}
            src={hlsSource ? undefined : source}
            poster={poster}
            controls
            autoPlay
            playsInline
            onLoadedMetadata={applyResume}
            onPause={event =>
              saveProgress(event.currentTarget.currentTime, event.currentTarget.duration)
            }
            onTimeUpdate={event => {
              if (Date.now() - lastSave.current < 5000) return
              lastSave.current = Date.now()
              saveProgress(event.currentTarget.currentTime, event.currentTarget.duration)
            }}
            onError={() => setPlayFailed(true)}
          />
        ) : (
          <div className="player-status">
            {playFailed
              ? t('player.unable')
              : (error ?? playback?.message ?? t('player.preparing'))}
          </div>
        )}
        <div className="player-meta">
          <strong>{displayTitle(media)}</strong>
          <span>
            {media.video_codec ?? t('common.unknownCodec')} ·{' '}
            {formatDuration(media.duration)}
            {playback?.mode === 'preparing' ? ` · ${t('player.transcoding')}` : ''}
          </span>
        </div>
        {(playFailed || error) && (
          <div className="notice error">
            <span>{playFailed ? t('player.unable') : error}</span>
            <ErrorDetail detail={playFailed ? null : errorDetail} t={t} />
          </div>
        )}
      </div>
    </div>
  )
}
