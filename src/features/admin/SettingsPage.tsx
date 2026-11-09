import { useState } from 'react'

import { useSettings } from '../../app/settings'
import { fetchAdminHealth, shutdown } from '../../data/client'
import { useQuery } from '../../data/hooks'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button'
import { useConfirm } from '../../ui/Feedback'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { ChoiceGroup, FactList, Notice, PathList, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * Appearance is a browser preference, not server state: it is written straight
 * through the settings context, which applies it to the document and stores it
 * locally. Everything below is read-only facts about this install.
 */
export function SettingsPage() {
  const t = useT()
  const { settings, update, reset } = useSettings()
  const health = useQuery('admin:health', fetchAdminHealth, { staleTime: 15_000 })
  const confirm = useConfirm()
  const stop = useAction()
  const [stopped, setStopped] = useState(false)

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

  return (
    <div className={styles.stack}>
      <Panel title={t('settings.appearance')} note={t('settings.appearance.body')}>
        <div className={styles.settingsGrid}>
          <ChoiceGroup
            label={t('settings.theme')}
            value={settings.theme}
            onChange={theme => update({ theme })}
            options={[
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'light', label: t('settings.theme.light') },
            ]}
          />
          <ChoiceGroup
            label={t('settings.accent')}
            value={settings.accent}
            onChange={accent => update({ accent })}
            options={[
              { value: 'tungsten', label: t('settings.accent.tungsten') },
              { value: 'mint', label: t('settings.accent.mint') },
              { value: 'rose', label: t('settings.accent.rose') },
              { value: 'steel', label: t('settings.accent.steel') },
            ]}
          />
          <ChoiceGroup
            label={t('settings.density')}
            value={settings.density}
            onChange={density => update({ density })}
            options={[
              { value: 'comfortable', label: t('settings.density.comfortable') },
              { value: 'compact', label: t('settings.density.compact') },
            ]}
          />
          <ChoiceGroup
            label={t('settings.motion')}
            value={settings.motion}
            onChange={motion => update({ motion })}
            options={[
              { value: 'full', label: t('settings.motion.full') },
              { value: 'reduced', label: t('settings.motion.reduced') },
            ]}
          />
          <ChoiceGroup
            label={t('settings.language')}
            value={settings.lang}
            onChange={lang => update({ lang })}
            hint={t('settings.language.body')}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh', label: '中文' },
            ]}
          />
        </div>

        <div className={styles.formFoot}>
          <Button variant="secondary" icon="refresh" onClick={reset}>
            {t('settings.reset')}
          </Button>
        </div>
      </Panel>

      <Panel title={t('settings.about')} note={t('settings.about.body')}>
        {health.error ? <Notice error={health.error} onDismiss={() => health.reload()} /> : null}
        {health.data ? (
          <>
            <FactList
              items={[
                {
                  key: 'version',
                  label: t('overview.version'),
                  value: health.data.version,
                  mono: true,
                },
                { key: 'mode', label: t('overview.mode'), value: health.data.mode, mono: true },
              ]}
            />
            <h3 className={styles.subHead}>{t('overview.paths')}</h3>
            <PathList health={health.data} />
          </>
        ) : health.loading ? (
          <LoadingRow>{t('common.loading')}</LoadingRow>
        ) : null}
      </Panel>

      <Panel title={t('settings.danger')} note={t('settings.danger.body')}>
        {stop.error ? <Notice error={stop.error} onDismiss={stop.reset} /> : null}
        {stopped ? (
          <p className={styles.ok}>{t('overview.shutdown.done')}</p>
        ) : (
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
        )}
      </Panel>
    </div>
  )
}
