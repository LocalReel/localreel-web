import { useEffect, useState } from 'react'
import { fetchHealth, type Health } from './api'

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHealth()
      .then(value => {
        if (!cancelled) setHealth(value)
      })
      .catch(reason => {
        if (!cancelled) setError(String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      padding: '2rem',
    }}>
      <section style={{
        width: 'min(40rem, 100%)',
        padding: '2.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: '1rem',
        boxShadow: '0 18px 50px rgba(54, 47, 35, 0.05)',
      }}>
        <p style={{
          color: 'var(--accent)',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}>
          Local-first media
        </p>
        <h1 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          lineHeight: 1.05,
          margin: '0.4rem 0 1rem',
        }}>
          LocalReel
        </h1>
        <p style={{ color: 'var(--muted)', maxWidth: '32rem' }}>
          The server API is running. The media library, feed and player are being
          ported from the previous implementation; this page is the new shell's
          health handshake.
        </p>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--canvas)',
          borderRadius: '0.75rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          fontSize: '0.85rem',
          lineHeight: 1.8,
        }}>
          {error && <div style={{ color: '#b3261e' }}>error: {error}</div>}
          {!health && !error && <div>checking server…</div>}
          {health && (
            <>
              <div>status: {health.status}</div>
              <div>version: {health.version}</div>
              <div>database: {health.database ? 'ok' : 'down'}</div>
              <div>ffmpeg: {health.ffmpeg ? 'ok' : 'missing'}</div>
              <div>media: {health.media_count}</div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
