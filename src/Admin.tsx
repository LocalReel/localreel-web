import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import LangSwitch from './LangSwitch'
import ErrorDetail from './ErrorDetail'
import { useAuth } from './auth'
import {
  addSource,
  createUser,
  deleteSource,
  deleteUser,
  describeError,
  fetchAdminHealth,
  fetchCacheStats,
  fetchJobs,
  fetchMetadataStatus,
  fetchPluginAudit,
  fetchPluginLogs,
  fetchPlugins,
  fetchScanRuns,
  fetchSources,
  fetchUsers,
  importBackup,
  matchMetadata,
  remapSource,
  restartPlugin,
  restoreBackup,
  runCacheGc,
  setSourceArchived,
  setSourceEnabled,
  setPluginEnabled,
  shutdownServer,
  triggerScan,
  updateUser,
  type AdminHealth,
  type BackupImportReport,
  type CacheGcReport,
  type CacheStats,
  type JobRecord,
  type MetadataStatus,
  type PluginAuditEntry,
  type PluginSummary,
  type RemapReport,
  type Role,
  type ScanRun,
  type Source,
  type User,
} from './api'
import { useLang, type Translate, type TranslationKey } from './i18n'

const jobStatusKeys: Record<string, TranslationKey> = {
  queued: 'admin.jobStatus.queued',
  running: 'admin.jobStatus.running',
  succeeded: 'admin.jobStatus.succeeded',
  failed: 'admin.jobStatus.failed',
  canceled: 'admin.jobStatus.canceled',
}

/** Localise the known API job/scan statuses; unknown values stay untouched. */
function statusLabel(status: string, t: Translate): string {
  const key = jobStatusKeys[status]
  return key ? t(key) : status
}

function gcJobSummary(job: JobRecord, t: Translate): string | null {
  if (!job.result) return null
  try {
    const result = JSON.parse(job.result) as {
      removed?: number
      freed_bytes?: number
      kept?: number
    }
    return t('admin.cache.gcSummary', {
      removed: result.removed ?? 0,
      freed: formatBytes(result.freed_bytes ?? 0),
      kept: result.kept ?? 0,
    })
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
  const { lang, setLang, t } = useLang()
  const { user, logout } = useAuth()
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [runs, setRuns] = useState<ScanRun[]>([])
  const [cache, setCache] = useState<CacheStats | null>(null)
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [pluginAudit, setPluginAudit] = useState<PluginAuditEntry[]>([])
  const [metadata, setMetadata] = useState<MetadataStatus | null>(null)
  const [matchingMetadata, setMatchingMetadata] = useState(false)
  const [metadataMatched, setMetadataMatched] = useState<{
    queued: number
    fresh: number
  } | null>(null)
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [scanning, setScanning] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  // Adding a library folder.
  const [newSource, setNewSource] = useState('')
  const [newKind, setNewKind] = useState('')
  const [adding, setAdding] = useState(false)

  // Account administration (administrators only).
  const [users, setUsers] = useState<User[]>([])
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as Role })
  const [userBusy, setUserBusy] = useState(false)

  // Stopping the process from the page (platforms without a tray).
  const [shuttingDown, setShuttingDown] = useState(false)
  const [shutdownDone, setShutdownDone] = useState(false)

  // Plugin controls: only one action at a time, and the log panel follows the
  // plugin whose button was pressed.
  const [pluginBusy, setPluginBusy] = useState<string | null>(null)
  const [pluginLog, setPluginLog] = useState<{ id: string; text: string } | null>(null)

  const shutdownRef = useRef(false)

  /**
   * Show a failure, keeping the server's diagnostics apart from the message.
   * Only an administrator receives `detail`, and only sometimes.
   */
  const fail = useCallback((cause: unknown) => {
    const parts = describeError(cause)
    setError(parts.message)
    setErrorDetail(parts.detail ?? null)
  }, [])

  /**
   * Ask the server to match every stale item against the provider.
   *
   * The work runs as jobs, so this only reports how many were queued.
   */
  const matchAllMetadata = useCallback(async () => {
    setMatchingMetadata(true)
    setMetadataMatched(null)
    setError(null)
    try {
      const report = await matchMetadata()
      setMetadataMatched(report)
    } catch (cause) {
      fail(cause)
    } finally {
      setMatchingMetadata(false)
    }
  }, [fail])

  const load = useCallback(async () => {
    // Once the process is stopping, its API is gone: stop polling so the page
    // shows the shutdown notice instead of a connection error.
    if (shutdownRef.current) return
    setError(null)
    try {
      const [
        nextHealth,
        nextSources,
        nextJobs,
        nextRuns,
        nextCache,
        nextPlugins,
        nextAudit,
        nextMetadata,
      ] = await Promise.all([
        fetchAdminHealth(),
        fetchSources(true),
        fetchJobs(20),
        fetchScanRuns(20),
        fetchCacheStats(),
        fetchPlugins(),
        fetchPluginAudit(20),
        fetchMetadataStatus(),
      ])
      setHealth(nextHealth)
      setSources(nextSources)
      setJobs(nextJobs)
      setRuns(nextRuns)
      setCache(nextCache)
      setPlugins(nextPlugins.plugins)
      setPluginAudit(nextAudit.entries)
      setMetadata(nextMetadata)
    } catch (cause) {
      fail(cause)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(timer)
  }, [load])

  const isAdmin = user.role === 'admin'

  const loadUsers = useCallback(async () => {
    if (user.role !== 'admin') return
    try {
      setUsers(await fetchUsers())
    } catch {
      // The diagnostics panel already reports connectivity problems.
    }
  }, [user.role])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const addFolder = async (event: FormEvent) => {
    event.preventDefault()
    const uri = newSource.trim()
    if (!uri) return
    setAdding(true)
    setError(null)
    setActionMessage(null)
    try {
      const source = await addSource(uri, newKind.trim() || undefined)
      setNewSource('')
      await triggerScan(source.id).catch(() => undefined)
      setActionMessage(t('admin.addSource.done', { uri: source.uri }))
      await load()
    } catch (cause) {
      setError(
        t('admin.addSource.error', {
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    } finally {
      setAdding(false)
    }
  }

  const addAccount = async (event: FormEvent) => {
    event.preventDefault()
    const username = newUser.username.trim()
    if (!username || !newUser.password) return
    setUserBusy(true)
    setError(null)
    setActionMessage(null)
    try {
      const created = await createUser(username, newUser.password, newUser.role)
      setNewUser({ username: '', password: '', role: 'user' })
      setActionMessage(t('admin.users.created', { username: created.username }))
      await loadUsers()
    } catch (cause) {
      setError(
        t('admin.users.failed', {
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    } finally {
      setUserBusy(false)
    }
  }

  const toggleAccount = async (account: User) => {
    setUserBusy(true)
    setError(null)
    try {
      await updateUser(account.id, { enabled: !account.enabled })
      await loadUsers()
    } catch (cause) {
      setError(
        t('admin.users.failed', {
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    } finally {
      setUserBusy(false)
    }
  }

  const resetPassword = async (account: User) => {
    const next = window.prompt(
      t('admin.users.resetPrompt', { username: account.username }),
    )
    if (!next) return
    setUserBusy(true)
    setError(null)
    try {
      await updateUser(account.id, { password: next })
      setActionMessage(t('admin.users.created', { username: account.username }))
    } catch (cause) {
      setError(
        t('admin.users.failed', {
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    } finally {
      setUserBusy(false)
    }
  }

  const removeAccount = async (account: User) => {
    if (!window.confirm(t('admin.users.deleteConfirm', { username: account.username }))) {
      return
    }
    setUserBusy(true)
    setError(null)
    try {
      await deleteUser(account.id)
      await loadUsers()
    } catch (cause) {
      setError(
        t('admin.users.failed', {
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      )
    } finally {
      setUserBusy(false)
    }
  }

  const remove = async (source: Source) => {
    setError(null)
    setActionMessage(null)
    try {
      const preview = await deleteSource(source.id, { dryRun: true })
      const detail = t('admin.remove.detail', {
        media: preview.media_count,
        states: preview.state_count,
        variants: preview.variant_count,
      })
      if (!window.confirm(t('admin.remove.confirm', { uri: source.uri, detail }))) {
        return
      }
      setRemoving(source.id)
      const report = await deleteSource(source.id, { deleteMedia: true })
      setActionMessage(
        t('admin.remove.done', {
          media: report.media_count,
          states: report.state_count,
          files: report.deleted_files,
        }),
      )
      await load()
    } catch (cause) {
      fail(cause)
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
      const message = t('admin.backup.import.confirm', {
        sources: preview.sources,
        states: preview.states,
        missing: preview.missing,
      })
      if (!window.confirm(message)) return
      const report = await importBackup(backupFile, false)
      setBackupReport(report)
      await load()
    } catch (cause) {
      fail(cause)
    } finally {
      setBackupBusy(false)
    }
  }

  const restoreSelectedBackup = async () => {
    if (!backupFile) return
    if (!window.confirm(t('admin.backup.restore.confirm'))) {
      return
    }
    setBackupBusy(true)
    setError(null)
    try {
      const queued = await restoreBackup(backupFile)
      setActionMessage(t('admin.backup.restore.queued', { jobId: queued.job_id }))
      setBackupReport(null)
      await load()
    } catch (cause) {
      fail(cause)
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
      fail(cause)
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
      fail(cause)
    } finally {
      setToggling(null)
    }
  }

  /**
   * Ask the supervisor to restart, enable or disable a plugin.
   *
   * The work happens asynchronously in the server's supervisor thread, so the
   * immediate response only says the intent was accepted; `load()` refreshes
   * the descriptors a moment later.
   */
  const controlPlugin = async (
    plugin: PluginSummary,
    action: 'restart' | 'enable' | 'disable',
  ) => {
    setPluginBusy(plugin.id)
    setError(null)
    try {
      if (action === 'restart') {
        await restartPlugin(plugin.id)
      } else {
        await setPluginEnabled(plugin.id, action === 'enable')
      }
      await load()
    } catch (cause) {
      fail(cause)
    } finally {
      setPluginBusy(null)
    }
  }

  const showPluginLogs = async (plugin: PluginSummary) => {
    setPluginBusy(plugin.id)
    setError(null)
    try {
      const { log } = await fetchPluginLogs(plugin.id)
      setPluginLog({ id: plugin.id, text: log })
    } catch (cause) {
      fail(cause)
    } finally {
      setPluginBusy(null)
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
      fail(cause)
    } finally {
      setRemapBusy(false)
    }
  }

  const applyRemap = async () => {
    if (!remapFor || !remapReport) return
    if (
      !window.confirm(
        t('admin.remap.confirm', {
          remapped: remapReport.remapped,
          missing: remapReport.missing,
          skipped: remapReport.skipped,
        }),
      )
    ) {
      return
    }
    setRemapBusy(true)
    setError(null)
    try {
      const report = await remapSource(remapFor.id, remapUri.trim(), false)
      setActionMessage(
        t('admin.remap.done', {
          remapped: report.remapped,
          missing: report.missing,
        }),
      )
      setRemapFor(null)
      setRemapReport(null)
      await load()
    } catch (cause) {
      fail(cause)
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
      fail(cause)
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
      fail(cause)
    } finally {
      setScanning(null)
    }
  }

  const powerOff = async () => {
    if (!window.confirm(t('admin.shutdown.confirm'))) return
    setShuttingDown(true)
    setError(null)
    try {
      await shutdownServer()
      shutdownRef.current = true
      setShutdownDone(true)
    } catch (cause) {
      fail(cause)
    } finally {
      setShuttingDown(false)
    }
  }
  return (
    <main className="shell admin">
      <header className="topbar">
        <div>
          <p className="kicker">{t('admin.kicker')}</p>
          <h1>{t('admin.title')}</h1>
        </div>
        <div className="topbar-right">
          <span className="signed-in">
            {t('admin.signedInAs', { username: user.username })}
          </span>
          <button type="button" className="ghost" onClick={() => void logout()}>
            {t('admin.action.signOut')}
          </button>
          <LangSwitch lang={lang} onChange={setLang} t={t} />
          <a className="nav-link" href="/">
            {t('nav.library.back')}
          </a>
        </div>
      </header>

      {error && (
        <div className="notice error">
          <span>{error}</span>
          <ErrorDetail detail={errorDetail} t={t} />
        </div>
      )}
      {actionMessage && <div className="notice">{actionMessage}</div>}
      {loading && !health && <div className="notice">{t('admin.loading')}</div>}

      {health && (
        <section className="stats" aria-label={t('admin.diagnostics')}>
          <article className="stat">
            <span className="stat-label">{t('admin.status')}</span>
            <strong className={health.status === 'ok' ? 'ok' : 'bad'}>
              {health.status === 'ok' ? t('admin.healthStatus.ok') : health.status}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">{t('admin.stat.database')}</span>
            <strong className={health.database ? 'ok' : 'bad'}>
              {health.database
                ? t('admin.status.connected')
                : t('admin.status.unavailable')}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">{t('admin.stat.ffmpeg')}</span>
            <strong className={health.ffmpeg ? 'ok' : 'bad'}>
              {health.ffmpeg
                ? t('admin.status.available')
                : health.ffmpeg_capability === 'probe-only'
                  ? t('admin.status.probeOnly')
                  : t('common.missing')}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">{t('admin.stat.media')}</span>
            <strong>{health.media_count}</strong>
          </article>
          <article className="stat">
            <span className="stat-label">{t('admin.stat.watch')}</span>
            <strong className={health.watchers.enabled ? 'ok' : 'bad'}>
              {health.watchers.enabled
                ? t('admin.watch.active', { count: health.watchers.active })
                : t('admin.watch.disabled')}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">{t('admin.stat.transcode')}</span>
            <strong
              className={
                health.transcodes.running < health.transcodes.limit ? 'ok' : 'bad'
              }
            >
              {t('admin.transcode.usage', {
                running: health.transcodes.running,
                limit: health.transcodes.limit,
              })}
            </strong>
          </article>
          <article className="stat">
            <span className="stat-label">{t('admin.stat.hwaccel')}</span>
            <strong className={health.hwaccel === 'none' ? '' : 'ok'}>
              {health.hwaccel === 'none' ? t('admin.status.cpu') : health.hwaccel}
            </strong>
          </article>
        </section>
      )}

      {health && health.transcodes.queued > 0 && (
        <p className="notice">
          {t('admin.transcode.queued', { count: health.transcodes.queued })}
        </p>
      )}

      {health && health.ffmpeg_capability === 'missing' && (
        <p className="notice error">{t('admin.ffmpeg.hint')}</p>
      )}

      {health && health.ffmpeg_capability === 'probe-only' && (
        <p className="notice">{t('admin.ffmpeg.probeOnly')}</p>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>{t('admin.addSource.title')}</h2>
        </div>
        <form className="add-source" onSubmit={event => void addFolder(event)}>
          <input
            className="grow"
            aria-label={t('admin.addSource.title')}
            placeholder={t('admin.addSource.placeholder')}
            value={newSource}
            onChange={event => setNewSource(event.target.value)}
          />
          <input
            className="kind"
            aria-label={t('admin.addSource.kind')}
            placeholder={t('admin.addSource.kindHint')}
            value={newKind}
            onChange={event => setNewKind(event.target.value)}
          />
          <button
            type="submit"
            className="primary"
            disabled={adding || !newSource.trim()}
          >
            {adding ? t('admin.addSource.working') : t('admin.addSource.submit')}
          </button>
        </form>
        <p className="hint">{t('admin.addSource.hint')}</p>
      </section>

      {isAdmin && (
        <section className="panel">
          <div className="panel-head">
            <h2>{t('admin.users.title')}</h2>
          </div>
          <p className="muted">{t('admin.users.subtitle')}</p>

          <form className="add-user" onSubmit={event => void addAccount(event)}>
            <input
              aria-label={t('admin.users.username')}
              placeholder={t('admin.users.username')}
              value={newUser.username}
              onChange={event =>
                setNewUser(previous => ({ ...previous, username: event.target.value }))
              }
            />
            <input
              type="password"
              aria-label={t('admin.users.password')}
              placeholder={t('admin.users.password')}
              value={newUser.password}
              onChange={event =>
                setNewUser(previous => ({ ...previous, password: event.target.value }))
              }
            />
            <select
              aria-label={t('admin.users.role')}
              value={newUser.role}
              onChange={event =>
                setNewUser(previous => ({
                  ...previous,
                  role: event.target.value as Role,
                }))
              }
            >
              <option value="user">{t('admin.users.roleUser')}</option>
              <option value="admin">{t('admin.users.roleAdmin')}</option>
            </select>
            <button
              type="submit"
              className="primary"
              disabled={
                userBusy || !newUser.username.trim() || !newUser.password.trim()
              }
            >
              {userBusy ? t('admin.users.creating') : t('admin.users.create')}
            </button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('admin.users.username')}</th>
                  <th>{t('admin.users.role')}</th>
                  <th>{t('admin.users.lastLogin')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map(account => (
                  <tr key={account.id}>
                    <td className="mono">
                      {account.username}
                      {account.id === user.id ? ` (${t('admin.users.self')})` : ''}
                    </td>
                    <td>
                      {account.role === 'admin'
                        ? t('admin.users.roleAdmin')
                        : t('admin.users.roleUser')}
                      {account.enabled ? '' : ` · ${t('admin.value.no')}`}
                    </td>
                    <td>
                      {account.last_login_at
                        ? new Date(account.last_login_at * 1000).toLocaleString(
                            lang === 'zh' ? 'zh-CN' : 'en',
                          )
                        : t('admin.users.never')}
                    </td>
                    <td className="right">
                      {account.id !== user.id && (
                        <>
                          <button
                            type="button"
                            className="ghost"
                            disabled={userBusy}
                            onClick={() => void toggleAccount(account)}
                          >
                            {account.enabled
                              ? t('admin.users.disable')
                              : t('admin.users.enable')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={userBusy}
                            onClick={() => void resetPassword(account)}
                          >
                            {t('admin.users.reset')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={userBusy || account.id === 1}
                            onClick={() => void removeAccount(account)}
                          >
                            {t('admin.users.delete')}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>{t('admin.sources.title')}</h2>
          <button type="button" className="ghost" onClick={() => void load()}>
            {t('admin.refresh')}
          </button>
        </div>
        {sources.length === 0 ? (
          <p className="muted">{t('admin.sources.empty')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('admin.table.uri')}</th>
                  <th>{t('admin.table.kind')}</th>
                  <th>{t('admin.table.enabled')}</th>
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
                        ? t('admin.value.archived')
                        : source.enabled
                          ? t('admin.value.yes')
                          : t('admin.value.no')}
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
                            {t('admin.action.restore')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => startRemap(source)}
                          >
                            {t('admin.action.remap')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={removing === source.id}
                            onClick={() => void remove(source)}
                          >
                            {removing === source.id
                              ? t('admin.action.deleting')
                              : t('admin.action.delete')}
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
                            {source.enabled
                              ? t('admin.action.disable')
                              : t('admin.action.enable')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={toggling === source.id}
                            onClick={() => void archive(source)}
                          >
                            {t('admin.action.archive')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => startRemap(source)}
                          >
                            {t('admin.action.remap')}
                          </button>{' '}
                          <button
                            type="button"
                            className="ghost"
                            disabled={scanning === source.id || !source.enabled}
                            onClick={() => void scan(source.id)}
                          >
                            {scanning === source.id
                              ? t('admin.action.queueing')
                              : t('admin.action.scan')}
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
              {t('admin.remap.prefix')}
              <span className="mono">{remapFor.uri}</span>
              {t('admin.remap.suffix')}
            </p>
            <div className="remap-row">
              <input
                className="search"
                value={remapUri}
                placeholder={t('admin.remap.placeholder')}
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
                {remapBusy ? t('admin.action.checking') : t('admin.action.preview')}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!remapReport || remapBusy}
                onClick={() => void applyRemap()}
              >
                {t('admin.action.apply')}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setRemapFor(null)
                  setRemapReport(null)
                }}
              >
                {t('admin.action.cancel')}
              </button>
            </div>
            {remapReport && (
              <p className="muted">
                {t('admin.remap.report', {
                  remapped: remapReport.remapped,
                  missing: remapReport.missing,
                  skipped: remapReport.skipped,
                })}
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
          <h2>{t('admin.cache.title')}</h2>
          <button
            type="button"
            className="ghost"
            disabled={gcRunning}
            onClick={() => void collectGarbage()}
          >
            {gcRunning ? t('admin.cache.running') : t('admin.cache.run')}
          </button>
        </div>
        {cache ? (
          <dl className="paths">
            <dt>{t('admin.cache.total')}</dt>
            <dd>{formatBytes(cache.total_bytes)}</dd>
            <dt>{t('admin.cache.transcodes')}</dt>
            <dd>
              {cache.transcode_count} · {formatBytes(cache.transcode_bytes)}
            </dd>
            <dt>{t('admin.cache.thumbnails')}</dt>
            <dd>
              {cache.thumbnail_count} · {formatBytes(cache.thumbnail_bytes)}
            </dd>
          </dl>
        ) : (
          <p className="muted">{t('admin.cache.unavailable')}</p>
        )}
        {gcResult && (
          <p className="muted">
            {t('admin.cache.gcDone', {
              removed: gcResult.removed,
              freed: formatBytes(gcResult.freed_bytes),
              kept: gcResult.kept,
            })}
          </p>
        )}
        {latestGc && (
          <p className="muted">
            {t('admin.cache.lastJob', { status: statusLabel(latestGc.status, t) })}
            {gcJobSummary(latestGc, t) ? ` · ${gcJobSummary(latestGc, t)}` : ''}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('admin.backup.title')}</h2>
          <a className="ghost" href="/api/v1/backup" download>
            {t('admin.backup.export')}
          </a>
        </div>
        <p className="muted">{t('admin.backup.help')}</p>
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
            {backupBusy ? t('admin.action.working') : t('admin.action.import')}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!backupFile || backupBusy}
            onClick={() => void restoreSelectedBackup()}
            title={t('admin.backup.restoreTitle')}
          >
            {t('admin.action.restore')}
          </button>
        </div>
        {backupReport && (
          <>
            <p className="muted">
              {t('admin.backup.report', {
                sources: backupReport.sources_added,
                imported: backupReport.imported,
                unchanged: backupReport.unchanged,
                missing: backupReport.missing,
              })}
              {backupReport.warnings.length > 0
                ? ` · ${t('admin.backup.warnings', { count: backupReport.warnings.length })}`
                : ''}
            </p>
            {backupReport.users_created > 0 && (
              <p className="notice">
                {t('admin.backup.usersCreated', { count: backupReport.users_created })}
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>{t('admin.jobs.title')}</h2>
        {jobs.length === 0 ? (
          <p className="muted">{t('admin.jobs.empty')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('admin.table.kind')}</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.table.progress')}</th>
                  <th>{t('admin.table.attempts')}</th>
                  <th>{t('admin.table.error')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td className="mono">{job.kind}</td>
                    <td>
                      <span className={`pill ${job.status}`}>
                        {statusLabel(job.status, t)}
                      </span>
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
        <h2>{t('admin.scans.title')}</h2>
        {runs.length === 0 ? (
          <p className="muted">{t('admin.scans.empty')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('admin.table.source')}</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.table.discovered')}</th>
                  <th>{t('admin.table.added')}</th>
                  <th>{t('admin.table.updated')}</th>
                  <th>{t('admin.table.missing')}</th>
                  <th>{t('admin.table.failed')}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <td className="mono">{run.source_uri}</td>
                    <td>
                      <span className={`pill ${run.status}`}>
                        {statusLabel(run.status, t)}
                      </span>
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
          <h2>{t('admin.paths.title')}</h2>
          <dl className="paths">
            <dt>{t('admin.paths.data')}</dt>
            <dd className="mono">{health.data_dir}</dd>
            <dt>{t('admin.paths.thumbnails')}</dt>
            <dd className="mono">{health.thumbnail_dir}</dd>
            <dt>{t('admin.paths.transcodes')}</dt>
            <dd className="mono">{health.transcode_dir}</dd>
            <dt>{t('admin.paths.version')}</dt>
            <dd className="mono">{health.version}</dd>
            <dt>{t('admin.paths.watch')}</dt>
            <dd>
              {health.watchers.enabled
                ? t('admin.watch.active', { count: health.watchers.active })
                : t('admin.watch.disabled')}
              {health.watchers.skipped.length > 0 && (
                <>
                  {' · '}
                  {t('admin.watch.skipped')}: {health.watchers.skipped.join(', ')}
                </>
              )}
            </dd>
          </dl>
        </section>
      )}

      <section className="panel">
        <h2>{t('admin.metadata.title')}</h2>
        <p className="muted">{t('admin.metadata.help')}</p>
        {metadata?.provider ? (
          <p>
            {t('admin.metadata.active', {
              provider: metadata.provider,
              language: metadata.language,
            })}
          </p>
        ) : (
          <p className="muted">{t('admin.metadata.none')}</p>
        )}
        <button
          type="button"
          className="button"
          disabled={!metadata?.provider || matchingMetadata}
          onClick={() => void matchAllMetadata()}
        >
          {t('admin.metadata.match')}
        </button>
        {metadataMatched && (
          <p className="notice">
            {t('admin.metadata.queued', {
              count: metadataMatched.queued,
              fresh: metadataMatched.fresh,
            })}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>{t('admin.plugins.title')}</h2>
        <p className="muted">{t('admin.plugins.help')}</p>
        {plugins.length === 0 ? (
          <p className="muted">{t('admin.plugins.empty')}</p>
        ) : (
          <>
            <ul className="plugin-list">
              {plugins.map(plugin => (
                <li key={plugin.id}>
                  <strong>{plugin.name}</strong>
                  <span className="muted">
                    {' '}
                    · {plugin.id} v{plugin.version}
                  </span>
                  {plugin.state !== 'running' && (
                    <span className={`tag plugin-state ${plugin.state}`}>
                      {t(`admin.plugins.state.${plugin.state}` as TranslationKey)}
                    </span>
                  )}
                  {plugin.error && (
                    <p className="muted mono plugin-error">
                      {t('admin.plugins.error', { error: plugin.error })}
                    </p>
                  )}
                  <div className="plugin-permissions">
                    {plugin.permissions.map(permission => (
                      <span key={permission} className="tag">
                        {permission}
                      </span>
                    ))}
                  </div>
                  <div className="plugin-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={pluginBusy === plugin.id}
                      onClick={() => controlPlugin(plugin, 'restart')}
                    >
                      {t('admin.plugins.restart')}
                    </button>
                    {plugin.enabled ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={pluginBusy === plugin.id}
                        onClick={() => controlPlugin(plugin, 'disable')}
                      >
                        {t('admin.plugins.disable')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        disabled={pluginBusy === plugin.id}
                        onClick={() => controlPlugin(plugin, 'enable')}
                      >
                        {t('admin.plugins.enable')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary"
                      disabled={pluginBusy === plugin.id}
                      onClick={() => showPluginLogs(plugin)}
                    >
                      {t('admin.plugins.logs')}
                    </button>
                  </div>
                  {pluginLog?.id === plugin.id && (
                    <pre className="plugin-log mono">
                      {pluginLog.text.trim() || t('admin.plugins.logs.empty')}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
            {pluginAudit.length > 0 && (
              <>
                <h3>{t('admin.plugins.audit')}</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>plugin</th>
                        <th>action</th>
                        <th>detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pluginAudit.slice(0, 10).map(entry => (
                        <tr key={entry.id}>
                          <td>{entry.plugin_id}</td>
                          <td>{entry.action}</td>
                          <td className="mono">{entry.detail ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {health && isAdmin && (
        <section className="panel">
          <h2>{t('admin.shutdown.title')}</h2>
          <p className="muted">{t('admin.shutdown.help')}</p>
          {shutdownDone ? (
            <p className="notice">{t('admin.shutdown.done')}</p>
          ) : (
            <button
              type="button"
              className="ghost danger"
              disabled={shuttingDown}
              onClick={() => void powerOff()}
            >
              {shuttingDown
                ? t('admin.shutdown.busy')
                : t('admin.shutdown.action')}
            </button>
          )}
        </section>
      )}
    </main>
  )
}
