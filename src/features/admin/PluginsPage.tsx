import { routeHref } from '../../app/match'
import { Link } from '../../app/router'
import { fetchPlugins, restartPlugin, setPluginEnabled } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { PluginDescriptor } from '../../data/types'
import { useT } from '../../i18n'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Notice, PLUGIN_STATE_KEY, PLUGIN_STATE_TONE, buttonClass, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * One card per sidecar process.
 *
 * The console can only start, stop and restart; capabilities, secrets, logs and
 * the audit trail belong to the plugin's own page, so the card links there
 * rather than growing a second surface.
 */
export function PluginsPage() {
  const t = useT()
  const plugins = useQuery('plugins', fetchPlugins, { staleTime: 15_000 })
  const action = useAction()

  const toggle = (plugin: PluginDescriptor) => {
    void action.run(
      `toggle:${plugin.id}`,
      () => setPluginEnabled(plugin.id, !plugin.enabled),
      () => plugins.reload(),
    )
  }

  const restart = (plugin: PluginDescriptor) => {
    void action.run(
      `restart:${plugin.id}`,
      () => restartPlugin(plugin.id),
      () => plugins.reload(),
    )
  }

  const rows = plugins.data ?? []

  return (
    <div className={styles.stack}>
      {action.error ? <Notice error={action.error} onDismiss={action.reset} /> : null}

      <Panel
        title={t('plugins.title')}
        note={t('plugins.subtitle')}
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={plugins.refreshing}
            onClick={() => plugins.reload()}
          />
        }
      >
        {plugins.error ? <Notice error={plugins.error} onDismiss={() => plugins.reload()} /> : null}

        {plugins.loading && plugins.data === undefined ? (
          <LoadingRow>{t('common.loading')}</LoadingRow>
        ) : plugins.error && plugins.data === undefined ? null : rows.length === 0 ? (
          <Empty title={t('plugins.empty')} body={t('plugins.emptyBody')} />
        ) : (
          <div className={styles.cards}>
            {rows.map(plugin => (
              <article key={plugin.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>{plugin.name}</h3>
                  <Badge tone={PLUGIN_STATE_TONE[plugin.state]}>
                    {t(PLUGIN_STATE_KEY[plugin.state])}
                  </Badge>
                  <span className={styles.cardVer}>
                    {t('plugins.version', { version: plugin.version })}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  <span>
                    {t('plugins.package')} <code>{plugin.package}</code>
                  </span>
                  <span>{t('plugins.restarts', { count: plugin.restarts })}</span>
                  {plugin.network ? <Badge tone="outline">{t('plugins.network')}</Badge> : null}
                </div>

                <div>
                  <p className={styles.hintLine}>{t('plugins.permissions')}</p>
                  <div className={styles.chips}>
                    {plugin.permissions.length === 0 ? (
                      <span className={styles.hintLine}>{t('common.none')}</span>
                    ) : (
                      plugin.permissions.map(permission => (
                        <span key={permission} className={styles.chip}>
                          {permission}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {plugin.error ? (
                  <p className={styles.badCount}>
                    {t('plugins.error.last')}: {plugin.error}
                  </p>
                ) : null}

                <div className={styles.cardFoot}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="refresh"
                    loading={action.pending === `restart:${plugin.id}`}
                    disabled={!plugin.enabled || action.pending != null}
                    onClick={() => restart(plugin)}
                  >
                    {t('plugins.action.restart')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={action.pending === `toggle:${plugin.id}`}
                    disabled={action.pending != null}
                    onClick={() => toggle(plugin)}
                  >
                    {plugin.enabled
                      ? t('plugins.action.disable')
                      : t('plugins.action.enable')}
                  </Button>
                  <Link
                    to={routeHref('admin.plugin', { id: plugin.id })}
                    className={buttonClass('secondary', 'sm')}
                  >
                    {t('plugins.action.open')}
                    <Icon name="chevron-right" size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
