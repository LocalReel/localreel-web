import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminHealth,
  fetchJobs,
  fetchScanRuns,
  fetchSources,
  setSourceEnabled,
  triggerScan,
  type AdminHealth,
  type JobRecord,
  type ScanRun,
  type Source,
} from './api'

export default function Admin() {
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [runs, setRuns] = useState<ScanRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextHealth, nextSources, nextJobs, nextRuns] = await Promise.all([
        fetchAdminHealth(),
        fetchSources(),
        fetchJobs(20),
        fetchScanRuns(20),
      ])
      setHealth(nextHealth)
      setSources(nextSources)
      setJobs(nextJobs)
      setRuns(nextRuns)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(timer)
  }, [load])

  const toggle = async (source: Source) => {
    setToggling(source.id)
    setError(null)
    try {
      await setSourceEnabled(source.id, !source.enabled)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setToggling(null)
    }
  }

  const scan = async (sourceId: number) => {
    setScanning(sourceId)
    setError(null)
    try {
      await triggerScan(sourceId)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setScanning(null)
    }
  }

  return (
    <main className="shell admin">
      <header className="topbar">
        <div>
          <p className="kicker">Operations</p>
          <h1>Admin</h1>
        </div>
        <a className="nav-link" href="/">
          ← Library
        </a>
      </header>

      {error && <div className="notice error">{error}</div>}
      {loading && !health && <div className="notice">Loading diagnostics…</div>}

      {health && (
        <section className="stats" aria-label="Diagnostics">
          <article className="stat">
            <span className="stat-label">Status</span>
            <strong className={health.status === 'ok' ? 'ok' : 'bad'}>
              {health.status}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">Database</span>
            <strong className={health.database ? 'ok' : 'bad'}>
              {health.database ? 'connected' : 'unavailable'}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">ffmpeg</span>
            <strong className={health.ffmpeg ? 'ok' : 'bad'}>
              {health.ffmpeg ? 'available' : 'missing'}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">Media</span>
            <strong>{health.media_count}</strong>
          </article>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Sources</h2>
          <button type="button" className="ghost" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {sources.length === 0 ? (
          <p className="muted">No sources. Add one through the API.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>URI</th>
                  <th>Kind</th>
                  <th>Enabled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sources.map(source => (
                  <tr key={source.id}>
                    <td className="mono">{source.uri}</td>
                    <td>{source.kind}</td>
                    <td>{source.enabled ? 'yes' : 'no'}</td>
                    <td className="right">
                      <button
                        type="button"
                        className="ghost"
                        disabled={toggling === source.id}
                        onClick={() => void toggle(source)}
                      >
                        {source.enabled ? 'Disable' : 'Enable'}
                      </button>{' '}
                      <button
                        type="button"
                        className="ghost"
                        disabled={scanning === source.id || !source.enabled}
                        onClick={() => void scan(source.id)}
                      >
                        {scanning === source.id ? 'Queueing…' : 'Scan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Recent jobs</h2>
        {jobs.length === 0 ? (
          <p className="muted">No jobs yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td className="mono">{job.kind}</td>
                    <td>
                      <span className={`pill ${job.status}`}>{job.status}</span>
                    </td>
                    <td>{Math.round((job.progress ?? 0) * 100)}%</td>
                    <td>
                      {job.attempts}/{job.max_attempts}
                    </td>
                    <td className="error-cell">{job.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Scan history</h2>
        {runs.length === 0 ? (
          <p className="muted">No scans yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Discovered</th>
                  <th>Added</th>
                  <th>Updated</th>
                  <th>Missing</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <td className="mono">{run.source_uri}</td>
                    <td>
                      <span className={`pill ${run.status}`}>{run.status}</span>
                    </td>
                    <td>{run.discovered}</td>
                    <td>{run.added}</td>
                    <td>{run.updated}</td>
                    <td>{run.removed}</td>
                    <td>{run.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {health && (
        <section className="panel">
          <h2>Paths</h2>
          <dl className="paths">
            <dt>Data</dt>
            <dd className="mono">{health.data_dir}</dd>
            <dt>Thumbnails</dt>
            <dd className="mono">{health.thumbnail_dir}</dd>
            <dt>Transcodes</dt>
            <dd className="mono">{health.transcode_dir}</dd>
            <dt>Version</dt>
            <dd className="mono">{health.version}</dd>
          </dl>
        </section>
      )}
    </main>
  )
}
