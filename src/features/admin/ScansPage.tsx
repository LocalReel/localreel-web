import { useSettings } from '../../app/settings'
import { fetchScanIssues, fetchScanRuns } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { ScanIssue, ScanRun } from '../../data/types'
import { useT } from '../../i18n'
import { formatDateTime } from '../../lib/format'
import { Badge, type BadgeTone } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { Panel } from '../../ui/Panel'
import { Notice } from './shared'
import styles from './Admin.module.css'

function statusTone(status: string): BadgeTone {
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'accent'
  if (status === 'canceled' || status === 'skipped') return 'outline'
  return 'success'
}

/**
 * Scan history is two questions: what did each run change, and what could not
 * be read. They have different shapes, so they are two panels rather than one
 * wide table with half-empty columns.
 */
export function ScansPage() {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const runs = useQuery('scans:runs', () => fetchScanRuns(50), { staleTime: 15_000 })
  const issues = useQuery('scans:issues', () => fetchScanIssues(50), { staleTime: 15_000 })

  const runRows = runs.data ?? []
  const issueRows = issues.data ?? []

  const runColumns: Array<Column<ScanRun>> = [
    {
      key: 'source',
      header: t('scans.table.source'),
      cellClassName: styles.uriCell,
      render: run => (
        <span className={styles.uri} title={run.source_uri}>
          {run.source_uri}
        </span>
      ),
    },
    {
      key: 'started',
      header: t('scans.table.started'),
      width: '13rem',
      render: run => <span>{formatDateTime(run.started_at, lang)}</span>,
    },
    {
      key: 'status',
      header: t('scans.table.status'),
      width: '8rem',
      render: run => <Badge tone={statusTone(run.status)}>{run.status}</Badge>,
    },
    {
      key: 'discovered',
      header: t('scans.table.discovered'),
      align: 'right',
      width: '5rem',
      render: run => <span>{run.discovered}</span>,
    },
    {
      key: 'added',
      header: t('scans.table.added'),
      align: 'right',
      width: '5rem',
      render: run => <span>{run.added}</span>,
    },
    {
      key: 'updated',
      header: t('scans.table.updated'),
      align: 'right',
      width: '5rem',
      render: run => <span>{run.updated}</span>,
    },
    {
      key: 'unchanged',
      header: t('scans.table.unchanged'),
      align: 'right',
      width: '5rem',
      render: run => <span>{run.unchanged}</span>,
    },
    {
      key: 'removed',
      header: t('scans.table.removed'),
      align: 'right',
      width: '5rem',
      render: run => <span>{run.removed}</span>,
    },
    {
      key: 'failed',
      header: t('scans.table.failed'),
      align: 'right',
      width: '5rem',
      render: run => (
        <span className={run.failed > 0 ? styles.badCount : undefined}>{run.failed}</span>
      ),
    },
  ]

  const issueColumns: Array<Column<ScanIssue>> = [
    {
      key: 'uri',
      header: t('scans.issues.uri'),
      cellClassName: styles.uriCell,
      render: issue => (
        <span className={styles.uri} title={issue.uri}>
          {issue.uri}
        </span>
      ),
    },
    {
      key: 'kind',
      header: t('scans.issues.kind'),
      width: '9rem',
      render: issue => <span className={styles.mono}>{issue.kind}</span>,
    },
    {
      key: 'message',
      header: t('scans.issues.message'),
      render: issue => (
        <span className={styles.clip} title={issue.message}>
          {issue.message}
        </span>
      ),
    },
  ]

  return (
    <div className={styles.stack}>
      <Panel
        title={t('scans.title')}
        note={t('scans.subtitle')}
        flush
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={runs.refreshing}
            onClick={() => runs.reload()}
          />
        }
      >
        {runs.error ? (
          <div className={styles.pad}>
            <Notice error={runs.error} onDismiss={() => runs.reload()} />
          </div>
        ) : null}
        {runs.error && runs.data === undefined ? null : (
          <DataTable
            columns={runColumns}
            rows={runRows}
            rowKey={run => run.id}
            loading={runs.loading}
            empty={t('scans.empty')}
          />
        )}
      </Panel>

      <Panel
        title={t('scans.issues')}
        flush
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={issues.refreshing}
            onClick={() => issues.reload()}
          />
        }
      >
        {issues.error ? (
          <div className={styles.pad}>
            <Notice error={issues.error} onDismiss={() => issues.reload()} />
          </div>
        ) : null}
        {issues.error && issues.data === undefined ? null : (
          <DataTable
            columns={issueColumns}
            rows={issueRows}
            rowKey={issue => issue.id}
            loading={issues.loading}
            empty={t('scans.issues.empty')}
          />
        )}
      </Panel>
    </div>
  )
}
