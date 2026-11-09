import { useState } from 'react'

import { useSettings } from '../../app/settings'
import {
  fetchAdminHealth,
  fetchHealth,
  fetchMetadataStatus,
  fetchUpdateStatus,
  matchMetadata,
  shutdown,
} from '../../data/client'
import { useInterval, useQuery } from '../../data/hooks'
import { useT } from '../../i18n'
import { formatDateTime, formatNumber, formatSpan } from '../../lib/format'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { useConfirm, useToast } from '../../ui/Feedback'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Notice, PathList, StatTile, useAction } from './shared'
import styles from './Admin.module.css'

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

  const health = useQuery('admin:health', fetchAdminHealth, { staleTime: 5_000 })
  const runtime = useQuery('health', fetchHealth, { staleTime: 15_000 })
  const update = useQuery('admin:update', () => fetchUpdateStatus(false), { staleTime: 60_000 })
  const metadata = useQuery('admin:metadata', fetchMetadataStatus, { staleTime: 60_000 })

  const match = useAction()
  const stop = useAction()

  // Poll only while this page is mounted and only until the server is asked to
  // stop; afterwards every request is expected to fail.
  useInterval(() => health.reload(), stopped ? null : 5_000)

  const checkUpdates = async () => {
    setChecking(true)
    setCheckError(null)
    try {
      update.set(await fetchUpdateStatus(true))
    } catch (cause) {
      setCheckError(cause)
    } finally {
      setChecking(false)
    }
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
              disabled={update.data != null && !update.data.enabled}
              onClick={() => void checkUpdates()}
            >
              {checking ? t('overview.update.checking') : t('overview.update.check')}
            </Button>
          }
        >
          {update.error ? <Notice error={update.error} /> : null}
          {checkError ? (
            <Notice error={checkError} onDismiss={() => setCheckError(null)} />
          ) : null}

          {update.data ? (
            <>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>{t('overview.update.current')}</dt>
                  <dd className={`${styles.factValue} ${styles.mono}`}>{update.data.current}</dd>
                </div>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>{t('overview.update.latest')}</dt>
                  <dd className={`${styles.factValue} ${styles.mono}`}>
                    {update.data.latest?.version ?? t('common.unknown')}
                  </dd>
                </div>
              </dl>
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
              {!update.data.enabled ? (
                <p className={styles.muted}>{t('overview.update.disabled')}</p>
              ) : null}
              {update.data.error ? (
                <p className={styles.muted}>
                  {t('overview.update.failed', { message: update.data.error })}
                </p>
              ) : null}
              <p className={styles.hintLine}>{t('overview.update.note')}</p>
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
