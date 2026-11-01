import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Admin from './Admin'
import Reels from './Reels'
import {
  displayTitle,
  fetchMedia,
  formatDuration,
  preparePlayback,
  thumbnailUrl,
  type Media,
  type MediaFilter,
  type MediaPage,
  type Playback,
} from './api'

const filters: Array<{ id: MediaFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'continue', label: 'Continue' },
  { id: 'favorites', label: 'Favorites' },
]

export default function App() {
  if (window.location.pathname.startsWith('/watch')) return <Reels />
  if (window.location.pathname.startsWith('/admin')) return <Admin />
  return <Library />
}

function Library() {
  const [page, setPage] = useState<MediaPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [selected, setSelected] = useState<Media | null>(null)
  const requestId = useRef(0)

  const load = useCallback(
    async (offset = 0, append = false) => {
      const current = ++requestId.current
      setLoading(!append)
      setError(null)
      try {
        const next = await fetchMedia({
          q: query.trim() || undefined,
          filter,
          limit: 60,
          offset,
        })
        if (current !== requestId.current) return
        setPage(previous =>
          append && previous
            ? { ...next, items: [...previous.items, ...next.items] }
            : next,
        )
      } catch (cause) {
        if (current === requestId.current) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    },
    [filter, query],
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
          <p className="kicker">Local-first media</p>
          <h1>LocalReel</h1>
        </div>
        <div className="topbar-right">
          <p className="count">
            {total} {total === 1 ? 'item' : 'items'}
          </p>
          <a className="nav-link" href="/watch">
            Reels
          </a>
          <a className="nav-link" href="/admin">
            Admin →
          </a>
        </div>
      </header>

      <section className="controls" aria-label="Library controls">
        <input
          className="search"
          type="search"
          value={query}
          placeholder="Search title, filename or path"
          onChange={event => setQuery(event.target.value)}
        />
        <div className="filters" role="tablist" aria-label="Filters">
          {filters.map(entry => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              className={filter === entry.id ? 'filter active' : 'filter'}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="notice error">{error}</div>}
      {loading && !page && <div className="notice">Loading library…</div>}
      {empty && (
        <div className="notice">
          No media yet. Add a source with <code>POST /api/v1/sources</code> and run a scan.
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
                  {item.missing_at ? 'missing' : item.filename.split('.').pop()}
                </div>
              )}
              <span className="duration">{formatDuration(item.duration)}</span>
              {item.missing_at && <span className="badge">missing</span>}
            </div>
            <div className="meta">
              <span className="title">{displayTitle(item)}</span>
              <span className="sub">
                {item.video_codec ?? 'unknown'}
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
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {selected && (
        <Player media={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}

function Player({ media, onClose }: { media: Media; onClose: () => void }) {
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    let timer: number | undefined

    const resolve = async () => {
      try {
        const next = await preparePlayback(media.id)
        if (cancelled.current) return
        setPlayback(next)
        if (next.mode === 'preparing') {
          timer = window.setTimeout(() => void resolve(), 1200)
        }
      } catch (cause) {
        if (!cancelled.current) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }
    }

    void resolve()
    return () => {
      cancelled.current = true
      if (timer) window.clearTimeout(timer)
    }
  }, [media.id])

  const direct = playback?.mode === 'direct' || playback?.mode === 'ready'
  const source = direct ? playback?.url : undefined
  const poster = useMemo(() => thumbnailUrl(media) ?? undefined, [media])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={displayTitle(media)}>
      <div className="player">
        <button type="button" className="close" onClick={onClose} aria-label="Close player">
          ×
        </button>
        {source ? (
          <video
            key={source}
            src={source}
            poster={poster}
            controls
            autoPlay
            playsInline
            onError={() => setError('Unable to play this file.')}
          />
        ) : (
          <div className="player-status">
            {error ?? playback?.message ?? 'Preparing playback…'}
          </div>
        )}
        <div className="player-meta">
          <strong>{displayTitle(media)}</strong>
          <span>
            {media.video_codec ?? 'unknown'} · {formatDuration(media.duration)}
            {playback?.mode === 'preparing' ? ' · transcoding' : ''}
          </span>
        </div>
        {error && <div className="notice error">{error}</div>}
      </div>
    </div>
  )
}
