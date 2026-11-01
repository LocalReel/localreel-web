import { useCallback, useEffect, useState } from 'react'
import {
  deleteSource,
  fetchAdminHealth,
  fetchCacheStats,
  fetchJobs,
  fetchScanRuns,
  fetchSources,
  importBackup,
  remapSource,
  runCacheGc,
  setSourceArchived,
  setSourceEnabled,
  triggerScan,
  type AdminHealth,
  type BackupImportReport,
  type CacheGcReport,
  type CacheStats,
  type JobRecord,
  type RemapReport,
  type ScanRun,
  type Source,
} from './api'

function gcJobSummary(job: JobRecord): string | null {
  if (!job.result) return null
  try {
    const result = JSON.parse(job.result) as {
      removed?: number
      freed_bytes?: number
      kept?: number
    }
    return `removed ${result.removed ?? 0}, freed ${formatBytes(result.freed_bytes ?? 0)}, kept ${result.kept ?? 0}`
  } catch {
    return null
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export default function Admin() {
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [runs, setRuns] = useState<ScanRun[]>([])
  const [cache, setCache] = useState<CacheStats | null>(null)
  const [gcResult, setGcResult] = useState<CacheGcReport | null>(null)
  const [gcRunning, setGcRunning] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [remapFor, setRemapFor] = useState<Source | null>(null)
  const [remapUri, setRemapUri] = useState('')
  const [remapReport, setRemapReport] = useState<RemapReport | null>(null)
  const [remapBusy, setRemapBusy] = useState(false)
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupReport, setBackupReport] = useState<BackupImportReport | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const latestGc = jobs.find(job => job.kind === 'cache_gc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextHealth, nextSources, nextJobs, nextRuns, nextCache] =
        await Promise.all([
          fetchAdminHealth(),
          fetchSources(true),
          fetchJobs(20),
          fetchScanRuns(20),
          fetchCacheStats(),
        ])
      setHealth(nextHealth)
      setSources(nextSources)
      setJobs(nextJobs)
      setRuns(nextRuns)
      setCache(nextCache)
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

  const remove = async (source: Source) => {
    setError(null)
    setActionMessage(null)
    try {
      const preview = await deleteSource(source.id, { dryRun: true })
      const detail = `${preview.media_count} media items, ${preview.state_count} states, ${preview.variant_count} artifacts`
      if (!window.confirm(`Remove source ${source.uri}?\n\n${detail}\n\nThis deletes the source, media metadata, state and generated artifacts.`)) {
        return
      }
      setRemoving(source.id)
      const report = await deleteSource(source.id, { deleteMedia: true })
      setActionMessage(
        `Removed source: ${report.media_count} media, ${report.state_count} states, ${report.deleted_files} files.`,
      )
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRemoving(null)
    }
  }

  const importSelectedBackup = async () => {
    if (!backupFile) return
    setBackupBusy(true)
    setError(null)
    setBackupReport(null)
    try {
      const preview = await importBackup(backupFile, true)
      const message = `Import backup?\n\nSources: ${preview.sources}\nStates: ${preview.states}\nMissing states: ${preview.missing}\n\nExisting progress is never lowered.`
      if (!window.confirm(message)) return
      const report = await importBackup(backupFile, false)
      setBackupReport(report)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBackupBusy(false)
    }
  }

  const collectGarbage = async () => {
    setGcRunning(true)
    setError(null)
    try {
      const report = await runCacheGc()
      setGcResult(report)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setGcRunning(false)
    }
  }

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

  const startRemap = (source: Source) => {
    setRemapFor(source)
    setRemapUri('')
    setRemapReport(null)
    setError(null)
  }

  const previewRemap = async () => {
    if (!remapFor || !remapUri.trim()) return
    setRemapBusy(true)
    setError(null)
    try {
      const report = await remapSource(remapFor.id, remapUri.trim(), true)
      setRemapReport(report)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRemapBusy(false)
    }
  }

  const applyRemap = async () => {
    if (!remapFor || !remapReport) return
    if (
      !window.confirm(
        `Remap source?\n\n${remapReport.remapped} media will move, ${remapReport.missing} missing, ${remapReport.skipped} skipped.`,
      )
    ) {
      return
    }
    setRemapBusy(true)
    setError(null)
    try {
      const report = await remapSource(remapFor.id, remapUri.trim(), false)
      setActionMessage(
        `Remapped source: ${report.remapped} media, ${report.missing} missing.`,
      )
      setRemapFor(null)
      setRemapReport(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRemapBusy(false)
    }
  }

  const archive = async (source: Source) => {
    setToggling(source.id)
    setError(null)
    try {
      await setSourceArchived(source.id, !source.archived_at)
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
      {actionMessage && <div className="notice">{actionMessage}</div>}
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
                    <td>
                      {source.archived_at
                        ? 'archived'
                        : source.enabled
                          ? 'yes'
                          : 'no'}
                    </td>
                    <td className="right">
                      {source.archived_at ? (
                        <>
                          <button
                            type="button"
                            className="ghost"
                            disabled={toggling === source.id}
                            onClick={() => void archive(source)}
                          >
                            Restore
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => startRemap(source)}
                          >
                            Remap
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={removing === source.id}
                            onClick={() => void remove(source)}
                          >
                            {removing === source.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </>
                      ) : (
                        <>
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
                            disabled={toggling === source.id}
                            onClick={() => void archive(source)}
                          >
                            Archive
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => startRemap(source)}
                          >
                            Remap
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={scanning === source.id || !source.enabled}
                            onClick={() => void scan(source.id)}
                          >
                            {scanning === source.id ? 'Queueing…' : 'Scan'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {remapFor && (
          <div className="remap-form">
            <p className="muted">
              Remap <span className="mono">{remapFor.uri}</span> to a new local
              directory:
            </p>
            <div className="remap-row">
              <input
                className="search"
                value={remapUri}
                placeholder="New local directory"
                onChange={event => {
                  setRemapUri(event.target.value)
                  setRemapReport(null)
                }}
              />
              <button
                type="button"
                className="ghost"
                disabled={!remapUri.trim() || remapBusy}
                onClick={() => void previewRemap()}
              >
                {remapBusy ? 'Checking…' : 'Preview'}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!remapReport || remapBusy}
                onClick={() => void applyRemap()}
              >
                Apply
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setRemapFor(null)
                  setRemapReport(null)
                }}
              >
                Cancel
              </button>
            </div>
            {remapReport && (
              <p className="muted">
                remapped {remapReport.remapped} · missing {remapReport.missing} ·
                skipped {remapReport.skipped}
                {remapReport.warnings.length > 0
                  ? ` · ${remapReport.warnings.join('; ')}`
                  : ''}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Cache</h2>
          <button
            type="button"
            className="ghost"
            disabled={gcRunning}
            onClick={() => void collectGarbage()}
          >
            {gcRunning ? 'Running…' : 'Run GC'}
          </button>
        </div>
        {cache ? (
          <dl className="paths">
            <dt>Total</dt>
            <dd>{formatBytes(cache.total_bytes)}</dd>
            <dt>Transcodes</dt>
            <dd>
              {cache.transcode_count} · {formatBytes(cache.transcode_bytes)}
            </dd>
            <dt>Thumbnails</dt>
            <dd>
              {cache.thumbnail_count} · {formatBytes(cache.thumbnail_bytes)}
            </dd>
          </dl>
        ) : (
          <p className="muted">Cache stats unavailable.</p>
        )}
        {gcResult && (
          <p className="muted">
            Removed {gcResult.removed} variant(s), freed{' '}
            {formatBytes(gcResult.freed_bytes)}; {gcResult.kept} kept.
          </p>
        )}
        {latestGc && (
          <p className="muted">
            Last GC job: {latestGc.status}
            {gcJobSummary(latestGc) ? ` · ${gcJobSummary(latestGc)}` : ''}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Backup</h2>
          <a className="ghost" href="/api/v1/backup" download>
            Export JSON
          </a>
        </div>
        <p className="muted">
          Import merges liked/favorite flags and never lowers existing progress.
          Run a scan before importing if the source is new.
        </p>
        <div className="backup-import">
          <input
            type="file"
            accept="application/json,.json"
            onChange={event => {
              setBackupFile(event.target.files?.[0] ?? null)
              setBackupReport(null)
            }}
          />
          <button
            type="button"
            className="ghost"
            disabled={!backupFile || backupBusy}
            onClick={() => void importSelectedBackup()}
          >
            {backupBusy ? 'Importing…' : 'Import'}
          </button>
        </div>
        {backupReport && (
          <p className="muted">
            Sources +{backupReport.sources_added} · states imported{' '}
            {backupReport.imported} · unchanged {backupReport.unchanged} ·
            missing {backupReport.missing}
            {backupReport.warnings.length > 0
              ? ` · warnings ${backupReport.warnings.length}`
              : ''}
          </p>
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
