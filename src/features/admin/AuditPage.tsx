import { useSettings } from '../../app/settings'
import { fetchAdminAudit } from '../../data/client'
import { useQuery } from '../../data/hooks'
import { useT } from '../../i18n'
import { formatRelative } from '../../lib/format'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Notice } from './shared'
import styles from './Admin.module.css'

/**
 * What administrators did, newest first.
 *
 * Read-only on purpose: an audit trail that can be edited is not one. The list
 * is short by design (server actions, not every request), so a plain list reads
 * better than a table with four empty columns.
 */
export function AuditPage() {
  const t = useT()
  const { settings } = useSettings()
  const audit = useQuery('admin:audit', () => fetchAdminAudit(100), { staleTime: 15_000 })

  return (
    <Panel
      title={t('audit.title')}
      note={t('audit.body')}
      tools={
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('common.refresh')}
          onClick={() => audit.reload()}
        >
          <Icon name="refresh" size={15} />
        </button>
      }
    >
      {audit.error ? <Notice error={audit.error} onDismiss={() => audit.reload()} /> : null}

      {audit.loading && audit.data === undefined ? (
        <LoadingRow>{t('common.loading')}</LoadingRow>
      ) : (audit.data ?? []).length === 0 ? (
        <Empty title={t('audit.empty')} body={t('audit.emptyBody')} />
      ) : (
        <ul className={styles.auditList}>
          {(audit.data ?? []).map(entry => (
            <li key={entry.id} className={styles.auditItem}>
              <span className={styles.auditWhen}>
                {formatRelative(entry.at, settings.lang)}
              </span>
              <span className={styles.auditAction}>{actionLabel(entry.action, t)}</span>
              <span className={styles.auditWho}>{entry.username ?? t('audit.system')}</span>
              {entry.target ? <code className={styles.auditTarget}>{entry.target}</code> : null}
              {entry.detail ? <span className={styles.auditDetail}>{entry.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * Actions are stable identifiers (`source.delete`); the UI shows a sentence.
 * An action this build does not know is shown verbatim rather than dropped, so
 * an older console meeting a newer server still says what happened.
 */
function actionLabel(action: string, t: ReturnType<typeof useT>): string {
  if (action === 'source.delete') return t('audit.action.sourceDelete')
  if (action === 'server.shutdown') return t('audit.action.shutdown')
  if (action === 'user.create') return t('audit.action.userCreate')
  if (action === 'user.update') return t('audit.action.userUpdate')
  if (action === 'user.delete') return t('audit.action.userDelete')
  if (action === 'config.allow_remote') return t('audit.action.allowRemote')
  if (action === 'plugin.install') return t('audit.action.pluginInstall')
  if (action === 'plugin.uninstall') return t('audit.action.pluginUninstall')
  if (action === 'backup.restore') return t('audit.action.backupRestore')
  if (action === 'admin.api') return t('audit.action.adminApi')
  return action
}
