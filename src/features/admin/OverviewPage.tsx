import { useRef, useState } from 'react'

import { useSettings } from '../../app/settings'
import {
  applyUpdate,
  fetchAdminHealth,
  fetchHealth,
  fetchMetadataStatus,
  fetchUpdateStatus,
  matchMetadata,
  shutdown,
  startUpdateDownload,
} from '../../data/client'
import { useInterval, useQuery } from '../../data/hooks'
import type { UpdateDownload, UpdateInstallKind } from '../../data/types'
import { useT, type TranslationKey } from '../../i18n'
import { formatBytes, formatDateTime, formatNumber, formatSpan } from '../../lib/format'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { useConfirm, useToast } from '../../ui/Feedback'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { Progress } from '../../ui/Progress'
import { LoadingRow } from '../../ui/Spinner'
import { FactList, Notice, PathList, StatTile, buttonClass, type Fact, useAction } from './shared'
import styles from './Admin.module.css'
import updateStyles from './UpdateCard.module.css'

const INSTALL_KIND_KEY: Record<UpdateInstallKind, TranslationKey> = {
  per_user_setup: 'overview.update.install.perUser',
  system_msi: 'overview.update.install.system',
  portable: 'overview.update.install.portable',
}

const INSTALL_REASON_KEY: Record<'system_msi' | 'portable', TranslationKey> = {
  system_msi: 'overview.update.reason.system',
  portable: 'overview.update.reason.portable',
}

/**
 * The console's front page: is the machine healthy, what is it running, and
 * what is the one thing an operator might have to do about it.
 */
export function OverviewPage() {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const confirm = useConfirm()
  const toast = useToast()

  const [stopped, setStopped] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<unknown>(null)
  const [liveDownload, setLiveDownload] = useState<UpdateDownload | null>(null)
  const [pollError, setPollError] = useState<unknown>(null)
  const applyStarted = useRef(false)

  const health = useQuery('admin:health', fetchAdminHealth, { staleTime: 5_000 })
  const runtime = useQuery('health', fetchHealth, { staleTime: 15_000 })
  // Short stale window: returning to this tab must reveal a download another
  // view may have started, while a mounted card still polls only while busy.
  const update = useQuery('admin:update', () => fetchUpdateStatus(false), { staleTime: 1_000 })
  const metadata = useQuery('admin:metadata', fetchMetadataStatus, { staleTime: 60_000 })

  const match = useAction()
  const stop = useAction()
  const installer = useAction()

  // The download phase is the one value a write or a poll can move forward
  // while the cached status is still in flight, so the freshest download object
  // is kept here and outranks the query snapshot instead of rewriting it.
  const download = liveDownload ?? update.data?.download
  const phase = download?.phase ?? 'idle'
  const downloading = phase === 'downloading'
  const installing = phase === 'installing'
  const ready = phase === 'ready'
  const failed = phase === 'failed'
  const canApply = update.data?.install.can_apply ?? false
  const busy = downloading || installing || installer.pending != null

  const received = download?.bytes ?? 0
  const total = download?.total ?? 0
  const fraction = total > 0 ? Math.min(1, Math.max(0, received / total)) : 0
  const percent = total > 0 ? Math.round(fraction * 100) : null

  // Poll only while this page is mounted and only until the server is asked to
  // stop; afterwards every request is expected to fail.
  useInterval(() => health.reload(), stopped ? null : 5_000)

  // The updater runs in the background, so the card watches it once a second
  // and stops the moment it reaches a phase where more polling would be noise.
  useInterval(
    () => {
      void fetchUpdateStatus(false)
        .then(next => {
          // The POST that hands the installer over wins over any read that was
          // already in flight; it would only roll the card back to "ready".
          if (applyStarted.current) return
          setLiveDownload(next.download)
          setPollError(null)
        })
        .catch(setPollError)
    },
    downloading ? 1_000 : null,
  )

  const checkUpdates = async () => {
    setChecking(true)
    setCheckError(null)
    setPollError(null)
    try {
      const next = await fetchUpdateStatus(true)
      if (applyStarted.current) return
      update.set(next)
      setLiveDownload(next.download)
    } catch (cause) {
      setCheckError(cause)
    } finally {
      setChecking(false)
    }
  }

  const startDownload = () => {
    void installer.run('download', async () => {
      const next = await startUpdateDownload()
      setLiveDownload(next)
      setPollError(null)
      return next
    })
  }

  const installUpdate = () => {
    applyStarted.current = true
    void installer.run('apply', async () => {
      try {
        const next = await applyUpdate()
        setLiveDownload(next)
        return next
      } catch (cause) {
        // A rejected apply leaves the server up: let the ready state, and its
        // in-flight polls, continue as if nothing happened.
        applyStarted.current = false
        throw cause
      }
    })
  }

  const runMatch = () => {
    void match.run(
      'match',
      async () => {
        const result = await matchMetadata()
        toast.push(t('overview.metadata.queued', { count: result.queued }), 'success')
      },
      () => metadata.reload(),
    )
  }

  const shutdownServer = async () => {
    const ok = await confirm({
      title: t('overview.shutdown.confirm'),
      body: t('overview.shutdown.body'),
      confirmLabel: t('overview.shutdown.action'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return
    await stop.run('shutdown', async () => {
      await shutdown()
      setStopped(true)
    })
  }

  const data = health.data
  const capability = data?.ffmpeg_capability
  const capabilityLabel =
    capability === 'full'
      ? t('overview.ffmpeg.full')
      : capability === 'probe-only'
        ? t('overview.ffmpeg.probe')
        : t('overview.ffmpeg.missing')
  const capabilityBody =
    capability === 'missing'
      ? t('overview.ffmpeg.missingBody')
      : capability === 'probe-only'
        ? t('overview.ffmpeg.probeBody')
        : undefined
  const watched = data ? data.watchers.active + data.watchers.skipped.length : 0
  const providerConfigured =
    metadata.data != null && metadata.data.configured !== '' && metadata.data.configured !== 'none'
  const providerLabel = metadata.data
    ? (metadata.data.provider ?? metadata.data.configured)
    : ''

  const updateFacts: Fact[] = update.data
    ? [
        {
          key: 'current',
          label: t('overview.update.current'),
          value: update.data.current,
          mono: true,
        },
        {
          key: 'latest',
          label: t('overview.update.latest'),
          value: update.data.latest?.version ?? t('common.unknown'),
          mono: true,
        },
        {
          key: 'install',
          label: t('overview.update.install'),
          value: t(INSTALL_KIND_KEY[update.data.install.kind]),
        },
        ...(update.data.install.install_dir
          ? [
              {
                key: 'installDir',
                label: t('overview.update.installDir'),
                value: update.data.install.install_dir,
                mono: true,
              },
            ]
          : []),
      ]
    : []

  const releaseUrl = update.data?.latest?.url ?? null
  const releaseLink = releaseUrl ? (
    <a
      className={buttonClass('secondary', 'sm')}
      href={releaseUrl}
      target="_blank"
      rel="noreferrer"
    >
      <Icon name="external" size={15} />
      {t('overview.update.releasePage')}
    </a>
  ) : null
  const reasonText = update.data
    ? t(
        update.data.install.reason
          ? INSTALL_REASON_KEY[update.data.install.reason]
          : 'overview.update.reason.generic',
      )
    : ''

  const updateSummary = update.data ? (
    <>
      <FactList items={updateFacts} />
      <div className={styles.formFoot}>
        <Badge tone={update.data.update_available ? 'warning' : 'success'}>
          {update.data.update_available
            ? t('overview.update.available')
            : t('overview.update.none')}
        </Badge>
        {update.data.checked_at ? (
          <span className={styles.hintLine}>
            {formatDateTime(update.data.checked_at, lang)}
          </span>
        ) : null}
      </div>
    </>
  ) : null

  return (
    <div className={styles.stack}>
      <Panel
        title={t('overview.health')}
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={health.refreshing}
            onClick={() => health.reload()}
          />
        }
      >
        {health.error ? <Notice error={health.error} /> : null}

        {data ? (
          <>
            <div className={styles.tiles}>
              <StatTile
                label={t('overview.status')}
                value={
                  data.status === 'ok' ? t('overview.status.ok') : t('overview.status.degraded')
                }
                tone={data.status === 'ok' ? 'success' : 'warning'}
              />
              <StatTile
                label={t('overview.database')}
                value={data.database ? t('overview.database.ok') : t('overview.database.bad')}
                tone={data.database ? 'success' : 'danger'}
              />
              <StatTile
                label={t('overview.ffmpeg')}
                value={capabilityLabel}
                note={capabilityBody}
                tone={capability === 'full' ? 'success' : capability === 'missing' ? 'danger' : 'warning'}
              />
              <StatTile
                label={t('overview.media')}
                value={formatNumber(data.media_count, lang)}
              />
              <StatTile
                label={t('overview.hwaccel')}
                value={data.hwaccel ?? t('common.none')}
              />
              <StatTile
                label={t('overview.watchers')}
                value={data.watchers.enabled ? `${data.watchers.active}/${watched}` : t('common.disabled')}
                note={t('overview.watchers.body', {
                  active: data.watchers.active,
                  total: watched,
                })}
                alert={
                  data.watchers.skipped.length > 0
                    ? t('overview.watchers.skipped', { list: data.watchers.skipped.join(', ') })
                    : undefined
                }
              />
              <StatTile
                label={t('overview.transcodes')}
                value={`${data.transcodes.running}/${data.transcodes.limit}`}
                note={t('overview.transcodes.body', {
                  running: data.transcodes.running,
                  queued: data.transcodes.queued,
                  limit: data.transcodes.limit,
                })}
                alert={data.transcodes.queued > 0 ? t('overview.queued') : undefined}
              />
            </div>

            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('overview.version')}</span>
                <span className={styles.metaValue}>{data.version}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('overview.mode')}</span>
                <span className={styles.metaValue}>{data.mode}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('overview.uptime')}</span>
                <span className={styles.metaValue}>
                  {runtime.data ? formatSpan(runtime.data.uptime_seconds) : t('common.unknown')}
                </span>
              </div>
            </div>
          </>
        ) : health.loading ? (
          <LoadingRow>{t('common.loading')}</LoadingRow>
        ) : null}
      </Panel>

      <div className={styles.split}>
        <Panel
          title={t('overview.update')}
          tools={
            <Button
              size="sm"
              variant="secondary"
              icon="refresh"
              loading={checking}
              disabled={busy || (update.data != null && !update.data.enabled)}
              onClick={() => void checkUpdates()}
            >
              {checking ? t('overview.update.checking') : t('overview.update.check')}
            </Button>
          }
        >
          {!installing && update.error ? <Notice error={update.error} /> : null}
          {!installing && checkError ? (
            <Notice error={checkError} onDismiss={() => setCheckError(null)} />
          ) : null}
          {!installing && pollError ? <Notice error={pollError} /> : null}
          {installer.error ? (
            <Notice error={installer.error} onDismiss={installer.reset} />
          ) : null}

          {installing ? (
            <>
              {updateSummary}
              <div className={updateStyles.installing} role="status" aria-live="polite">
                <Icon name="refresh" size={18} />
                <div>
                  <p className={updateStyles.installingTitle}>
                    {t('overview.update.installing')}
                  </p>
                  <p className={updateStyles.installingHint}>
                    {t('overview.update.installingHint')}
                  </p>
                </div>
              </div>
            </>
          ) : update.data ? (
            <>
              {updateSummary}
              {!update.data.enabled ? (
                <p className={styles.muted}>{t('overview.update.disabled')}</p>
              ) : null}
              {update.data.error ? (
                <p className={styles.muted}>
                  {t('overview.update.failed', { message: update.data.error })}
                </p>
              ) : null}

              {downloading ? (
                <div
                  className={updateStyles.download}
                  role="group"
                  aria-label={t('overview.update.downloading')}
                  aria-busy="true"
                >
                  <div className={updateStyles.downloadHead}>
                    <span className={updateStyles.downloadLabel}>
                      {t('overview.update.downloading')}
                    </span>
                    <span className={updateStyles.downloadMeta}>
                      {percent == null
                        ? t('overview.update.download.progressUnknown', {
                            done: formatBytes(received),
                          })
                        : t('overview.update.download.progress', {
                            done: formatBytes(received),
                            total: formatBytes(total),
                            percent,
                          })}
                    </span>
                  </div>
                  {percent == null ? null : (
                    <Progress
                      value={fraction}
                      label={t('overview.update.download.aria', { percent })}
                    />
                  )}
                  <p className={updateStyles.downloadNote}>
                    {t('overview.update.download.note')}
                  </p>
                </div>
              ) : failed ? (
                <div className={updateStyles.action}>
                  {download?.error ? (
                    <Notice error={download.error} />
                  ) : (
                    <p className={updateStyles.body}>{t('overview.update.downloadFailed')}</p>
                  )}
                  {canApply ? (
                    <Button
                      variant="primary"
                      icon="download"
                      loading={installer.pending === 'download'}
                      disabled={installer.pending != null}
                      onClick={startDownload}
                    >
                      {t('overview.update.retryDownload')}
                    </Button>
                  ) : (
                    <p className={updateStyles.body}>{reasonText}</p>
                  )}
                  {canApply ? null : releaseLink}
                </div>
              ) : ready && canApply ? (
                <div className={updateStyles.action}>
                  <p className={updateStyles.body} role="status">
                    {t('overview.update.ready')}
                  </p>
                  <Button
                    variant="primary"
                    icon="refresh"
                    loading={installer.pending === 'apply'}
                    disabled={installer.pending != null}
                    onClick={installUpdate}
                  >
                    {t('overview.update.installNow')}
                  </Button>
                  <p className={updateStyles.warning}>
                    <Icon name="alert" size={14} />
                    <span>{t('overview.update.restartWarning')}</span>
                  </p>
                  <p className={updateStyles.body}>{t('overview.update.readyBody')}</p>
                </div>
              ) : !canApply ? (
                <div className={updateStyles.action}>
                  <p className={updateStyles.body}>{reasonText}</p>
                  {releaseLink}
                </div>
              ) : update.data.update_available ? (
                <div className={updateStyles.action}>
                  <Button
                    variant="primary"
                    icon="download"
                    loading={installer.pending === 'download'}
                    disabled={installer.pending != null}
                    onClick={startDownload}
                  >
                    {t('overview.update.download')}
                  </Button>
                </div>
              ) : null}

              <div className={updateStyles.footer}>
                {canApply ? releaseLink : null}
                <p className={updateStyles.note}>{t('overview.update.note')}</p>
              </div>
            </>
          ) : update.loading ? (
            <LoadingRow>{t('common.loading')}</LoadingRow>
          ) : null}
        </Panel>

        <Panel
          title={t('overview.metadata')}
          note={t('overview.metadata.body')}
          tools={
            <Button
              size="sm"
              variant="secondary"
              icon="film"
              loading={match.pending === 'match'}
              disabled={!providerConfigured}
              onClick={runMatch}
            >
              {t('overview.metadata.match')}
            </Button>
          }
        >
          {metadata.error ? <Notice error={metadata.error} /> : null}
          {match.error ? (
            <Notice error={match.error} onDismiss={match.reset} />
          ) : null}
          {metadata.data ? (
            providerConfigured ? (
              <p className={styles.metaValue}>{providerLabel}</p>
            ) : (
              <p className={styles.muted}>{t('overview.metadata.none')}</p>
            )
          ) : metadata.loading ? (
            <LoadingRow>{t('common.loading')}</LoadingRow>
          ) : null}
        </Panel>
      </div>

      <Panel title={t('overview.paths')}>
        {data ? (
          <PathList health={data} />
        ) : (
          <p className={styles.muted}>{t('common.loading')}</p>
        )}
      </Panel>

      <Panel title={t('overview.shutdown')}>
        {stop.error ? <Notice error={stop.error} onDismiss={stop.reset} /> : null}
        {stopped ? (
          <p className={styles.ok}>{t('overview.shutdown.done')}</p>
        ) : (
          <>
            <p className={styles.muted}>{t('overview.shutdown.body')}</p>
            <div className={styles.formFoot}>
              <Button
                variant="danger"
                icon="alert"
                loading={stop.pending === 'shutdown'}
                onClick={() => void shutdownServer()}
              >
                {t('overview.shutdown.action')}
              </Button>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
