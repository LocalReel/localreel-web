import { useSettings } from '../../app/settings'
import { fetchSessions, revokeSession } from '../../data/client'
import { useQuery } from '../../data/hooks'
import { useT } from '../../i18n'
import { formatRelative } from '../../lib/format'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Notice, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * Every browser currently signed in.
 *
 * The id shown is a hash of the session token, so seeing a session in this list
 * does not let an administrator become that session; it only lets them end it.
 */
export function SessionsPanel() {
  const t = useT()
  const { settings } = useSettings()
  const sessions = useQuery('admin:sessions', fetchSessions, { staleTime: 10_000 })
  const action = useAction()

  const revoke = (id: string) =>
    action.run(`revoke:${id}`, async () => {
      await revokeSession(id)
      await sessions.reload()
    })

  return (
    <Panel
      title={t('accounts.sessions.title')}
      note={t('accounts.sessions.body')}
      tools={
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('common.refresh')}
          onClick={() => sessions.reload()}
        >
          <Icon name="refresh" size={15} />
        </button>
      }
    >
      {action.error ? <Notice error={action.error} onDismiss={action.reset} /> : null}
      {sessions.error ? <Notice error={sessions.error} onDismiss={() => sessions.reload()} /> : null}

      {sessions.loading && sessions.data === undefined ? (
        <LoadingRow>{t('common.loading')}</LoadingRow>
      ) : (sessions.data ?? []).length === 0 ? (
        <Empty title={t('accounts.sessions.empty')} />
      ) : (
        <ul className={styles.sessionList}>
          {(sessions.data ?? []).map(session => (
            <li key={session.id} className={styles.sessionItem}>
              <div className={styles.sessionWho}>
                <span className={styles.sessionUser}>{session.username}</span>
                <span className={styles.sessionAgent}>
                  {session.user_agent ?? t('accounts.sessions.unknownAgent')}
                </span>
              </div>
              <span className={styles.sessionWhen}>
                {t('accounts.sessions.lastSeen', {
                  when: formatRelative(session.last_seen_at, settings.lang),
                })}
              </span>
              <button
                type="button"
                className={styles.sessionRevoke}
                disabled={action.pending != null}
                onClick={() => void revoke(session.id)}
              >
                {action.pending === `revoke:${session.id}`
                  ? t('common.loading')
                  : t('accounts.sessions.revoke')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
