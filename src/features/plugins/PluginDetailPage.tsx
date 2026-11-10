import { useState } from 'react'

import { routeHref } from '../../app/match'
import { Link } from '../../app/router'
import { useSettings } from '../../app/settings'
import {
  fetchAudit,
  fetchPluginLogs,
  fetchPlugins,
  restartPlugin,
  setPluginEnabled,
} from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { AuditEntry } from '../../data/types'
import { useT } from '../../i18n'
import { formatDateTime } from '../../lib/format'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Tabs } from '../../ui/Tabs'
import { CapabilitiesSection, SecretsSection } from './PluginAccess'
import {
  FactList,
  Notice,
  PLUGIN_STATE_KEY,
  PLUGIN_STATE_TONE,
  useAction,
} from '../admin/shared'
import styles from '../admin/Admin.module.css'

/**
 * One plugin, four questions: what did it ask for (capabilities), what did we
 * hand it (secrets), what did it say (logs) and what did it do (audit).
 */
export function PluginDetailPage({ pluginId }: { pluginId?: string }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const [tab, setTab] = useState('overview')
  const [logText, setLogText] = useState<string | null>(null)

  const plugins = useQuery('plugins', fetchPlugins, { staleTime: 15_000 })
  const audit = useQuery(
    pluginId ? `plugins:audit:${pluginId}` : null,
    () => fetchAudit(pluginId, 50),
    { staleTime: 15_000, enabled: tab === 'audit' },
  )
  const action = useAction()
  const log = useAction()

  const plugin = plugins.data?.find(entry => entry.id === pluginId)

  if (!plugin) {
    return (
      <div className={styles.stack}>
        <Link to={routeHref('plugins')} className={styles.backLink}>
          <Icon name="chevron-left" size={15} />
          {t('plugins.detail.back')}
        </Link>
        <Panel title={t('plugins.title')}>
          {plugins.error ? (
            <Notice error={plugins.error} onDismiss={() => plugins.reload()} />
          ) : plugins.loading ? (
            <LoadingRow>{t('common.loading')}</LoadingRow>
          ) : (
            <Empty title={t('plugins.empty')} body={t('plugins.emptyBody')} />
          )}
        </Panel>
      </div>
    )
  }

  const restart = () => {
    void action.run('restart', () => restartPlugin(plugin.id), () => plugins.reload())
  }

  const toggle = () => {
    void action.run(
      'toggle',
      () => setPluginEnabled(plugin.id, !plugin.enabled),
      () => plugins.reload(),
    )
  }

  const loadLog = () => {
    void log.run('log', async () => {
      setLogText(await fetchPluginLogs(plugin.id))
    })
  }

  const auditColumns: Array<Column<AuditEntry>> = [
    {
      key: 'when',
      header: t('plugins.audit.when'),
      width: '13rem',
      render: entry => <span>{formatDateTime(entry.at, lang)}</span>,
    },
    {
      key: 'action',
      header: t('plugins.audit.action'),
      render: entry => <span className={styles.mono}>{entry.action}</span>,
    },
    {
      key: 'capability',
      header: t('plugins.audit.capability'),
      render: entry => (
        <span className={styles.mono}>{entry.capability ?? t('common.none')}</span>
      ),
    },
    {
      key: 'result',
      header: t('plugins.audit.result'),
      width: '8rem',
      render: entry =>
        entry.result ? <Badge tone="outline">{entry.result}</Badge> : <span>—</span>,
    },
    {
      key: 'detail',
      header: t('plugins.audit.detail'),
      render: entry =>
        entry.detail ? (
          <span className={styles.clip} title={entry.detail}>
            {entry.detail}
          </span>
        ) : (
          <span className={styles.hintLine}>{t('common.none')}</span>
        ),
    },
  ]

  return (
    <div className={styles.stack}>
      <Link to={routeHref('plugins')} className={styles.backLink}>
        <Icon name="chevron-left" size={15} />
        {t('plugins.detail.back')}
      </Link>

      <header className={styles.pluginHeader}>
        <div>
          <h2 className={styles.pluginName}>{plugin.name}</h2>
          <div className={styles.pluginMeta}>
            <Badge tone={PLUGIN_STATE_TONE[plugin.state]}>
              {t(PLUGIN_STATE_KEY[plugin.state])}
            </Badge>
            <span>{t('plugins.version', { version: plugin.version })}</span>
            <code>{plugin.package}</code>
            <span>{t('plugins.restarts', { count: plugin.restarts })}</span>
          </div>
        </div>
        <div className={styles.formActions}>
          <Button
            size="sm"
            variant="secondary"
            icon="refresh"
            loading={action.pending === 'restart'}
            disabled={!plugin.enabled || action.pending != null}
            onClick={restart}
          >
            {t('plugins.action.restart')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={action.pending === 'toggle'}
            disabled={action.pending != null}
            onClick={toggle}
          >
            {plugin.enabled ? t('plugins.action.disable') : t('plugins.action.enable')}
          </Button>
        </div>
      </header>

      {action.error ? <Notice error={action.error} onDismiss={action.reset} /> : null}

      <div className={styles.sectionTabs}>
        <Tabs
          items={[
            { id: 'overview', label: t('plugins.detail.overview') },
            { id: 'capabilities', label: t('plugins.detail.capabilities') },
            { id: 'secrets', label: t('plugins.detail.secrets') },
            { id: 'logs', label: t('plugins.detail.logs') },
            { id: 'audit', label: t('plugins.detail.audit') },
          ]}
          value={tab}
          onChange={setTab}
          label={t('plugins.title')}
        />
      </div>

      {tab === 'overview' ? (
        <Panel title={t('plugins.detail.overview')}>
          {plugin.error ? (
            <p className={styles.badCount}>
              {t('plugins.error.last')}: {plugin.error}
            </p>
          ) : null}
          <FactList
            items={[
              {
                key: 'state',
                label: t('overview.status'),
                value: (
                  <Badge tone={PLUGIN_STATE_TONE[plugin.state]}>
                    {t(PLUGIN_STATE_KEY[plugin.state])}
                  </Badge>
                ),
              },
              {
                key: 'version',
                label: t('overview.version'),
                value: t('plugins.version', { version: plugin.version }),
                mono: true,
              },
              {
                key: 'package',
                label: t('plugins.package'),
                value: plugin.package,
                mono: true,
              },
              {
                key: 'network',
                label: t('plugins.network'),
                value: plugin.network ? t('common.enabled') : t('common.disabled'),
              },
              {
                key: 'transport',
                label: t('plugins.transport.label'),
                value: plugin.transport || t('common.none'),
                mono: true,
              },
              {
                key: 'sandbox',
                label: t('plugins.sandbox'),
                value:
                  plugin.sandbox === 'appcontainer'
                    ? t('plugins.sandbox.appcontainer')
                    : t('plugins.sandbox.none'),
              },
              {
                key: 'permissions',
                label: t('plugins.permissions'),
                value:
                  plugin.permissions.length === 0 ? (
                    <span className={styles.hintLine}>{t('common.none')}</span>
                  ) : (
                    <span className={styles.chips}>
                      {plugin.permissions.map(permission => (
                        <span key={permission} className={styles.chip}>
                          {permission}
                        </span>
                      ))}
                    </span>
                  ),
              },
            ]}
          />
        </Panel>
      ) : null}

      {tab === 'capabilities' ? <CapabilitiesSection pluginId={plugin.id} /> : null}
      {tab === 'secrets' ? <SecretsSection pluginId={plugin.id} /> : null}

      {tab === 'logs' ? (
        <Panel
          title={t('plugins.logs.title')}
          tools={
            <Button
              variant="secondary"
              size="sm"
              icon="terminal"
              loading={log.pending === 'log'}
              onClick={loadLog}
            >
              {logText == null ? t('plugins.action.logs') : t('common.refresh')}
            </Button>
          }
        >
          {log.error ? <Notice error={log.error} onDismiss={log.reset} /> : null}
          {logText == null ? (
            log.pending === 'log' ? (
              <LoadingRow>{t('plugins.logs.loading')}</LoadingRow>
            ) : (
              <p className={styles.muted}>{t('plugins.logs.empty')}</p>
            )
          ) : (
            <pre className={styles.log}>{logText.trim() || t('plugins.logs.empty')}</pre>
          )}
        </Panel>
      ) : null}

      {tab === 'audit' ? (
        <Panel
          title={t('plugins.audit.title')}
          flush
          tools={
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              aria-label={t('common.refresh')}
              loading={audit.refreshing}
              onClick={() => audit.reload()}
            />
          }
        >
          {audit.error ? (
            <div className={styles.pad}>
              <Notice error={audit.error} onDismiss={() => audit.reload()} />
            </div>
          ) : null}
          {audit.error && audit.data === undefined ? null : (
            <DataTable
              columns={auditColumns}
              rows={audit.data ?? []}
              rowKey={entry => entry.id}
              loading={audit.loading}
              empty={t('plugins.audit.empty')}
            />
          )}
        </Panel>
      ) : null}
    </div>
  )
}
