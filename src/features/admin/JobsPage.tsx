import { useSettings } from '../../app/settings'
import { cancelJob, fetchJobs } from '../../data/client'
import { useInterval, useQuery } from '../../data/hooks'
import type { JobRecord, JobStatus } from '../../data/types'
import { useT, type TranslationKey } from '../../i18n'
import { formatDateTime, formatRelative } from '../../lib/format'
import { Badge, type BadgeTone } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { Panel } from '../../ui/Panel'
import { Progress } from '../../ui/Progress'
import { Notice, useAction } from './shared'
import styles from './Admin.module.css'

const STATUS_KEY: Record<JobStatus, TranslationKey> = {
  queued: 'jobs.status.queued',
  running: 'jobs.status.running',
  succeeded: 'jobs.status.succeeded',
  failed: 'jobs.status.failed',
  canceled: 'jobs.status.canceled',
}

const STATUS_TONE: Record<JobStatus, BadgeTone> = {
  queued: 'neutral',
  running: 'accent',
  succeeded: 'success',
  failed: 'danger',
  canceled: 'outline',
}

/**
 * The queue, as a table.
 *
 * Jobs are the only high-traffic state in the console, so this page polls while
 * it is visible instead of waiting for a server event; the shared hook pauses
 * the timer when the tab is hidden and unmounts it with the page.
 */
export function JobsPage() {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const jobs = useQuery('jobs:50', () => fetchJobs(50), { staleTime: 3_000 })
  const row = useAction()

  useInterval(() => jobs.reload(), 4_000)

  const rows = jobs.data ?? []

  const cancel = (job: JobRecord) => {
    void row.run(`cancel:${job.id}`, () => cancelJob(job.id), () => jobs.reload())
  }

  const columns: Array<Column<JobRecord>> = [
    {
      key: 'kind',
      header: t('jobs.table.kind'),
      width: '9rem',
      render: job => <span className={styles.mono}>{job.kind}</span>,
    },
    {
      key: 'status',
      header: t('jobs.table.status'),
      width: '7rem',
      render: job => <Badge tone={STATUS_TONE[job.status]}>{t(STATUS_KEY[job.status])}</Badge>,
    },
    {
      key: 'progress',
      header: t('jobs.table.progress'),
      width: '9rem',
      render: job => {
        const percent = Math.round(Math.max(0, Math.min(1, job.progress)) * 100)
        return (
          <div className={styles.progressCell}>
            <span className={styles.progressBar}>
              <Progress value={job.progress} label={`${job.kind} ${percent}%`} />
            </span>
            <span className={styles.progressValue}>{percent}%</span>
          </div>
        )
      },
    },
    {
      key: 'attempts',
      header: t('jobs.table.attempts'),
      align: 'right',
      width: '6rem',
      render: job => (
        <span>
          {job.attempts}/{job.max_attempts}
        </span>
      ),
    },
    {
      key: 'message',
      header: t('jobs.table.message'),
      render: job => {
        const text = job.error ?? job.message ?? job.result
        if (!text) return <span className={styles.hintLine}>{t('common.none')}</span>
        return (
          <span
            className={job.error ? `${styles.clip} ${styles.badCount}` : styles.clip}
            title={text}
          >
            {text}
          </span>
        )
      },
    },
    {
      key: 'started',
      header: t('jobs.table.age'),
      width: '10rem',
      render: job =>
        job.started_at ? (
          <span title={formatDateTime(job.started_at, lang)}>
            {formatRelative(job.started_at, lang)}
          </span>
        ) : (
          <span className={styles.hintLine}>{t('common.never')}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: job =>
        job.status === 'queued' || job.status === 'running' ? (
          <Button
            size="sm"
            variant="ghost"
            icon="close"
            disabled={row.pending != null || job.cancel_requested}
            onClick={() => cancel(job)}
          >
            {t('jobs.action.cancel')}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className={styles.stack}>
      <Panel
        title={t('jobs.title')}
        note={t('jobs.subtitle')}
        flush
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={jobs.refreshing}
            onClick={() => jobs.reload()}
          />
        }
      >
        {jobs.error ? (
          <div className={styles.pad}>
            <Notice error={jobs.error} onDismiss={() => jobs.reload()} />
          </div>
        ) : null}
        {jobs.error && jobs.data === undefined ? null : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={job => job.id}
            loading={jobs.loading}
            empty={t('jobs.empty')}
          />
        )}
      </Panel>

      {row.error ? <Notice error={row.error} onDismiss={row.reset} /> : null}
    </div>
  )
}
