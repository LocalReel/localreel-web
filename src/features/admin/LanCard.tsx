import { useState } from 'react'

import { fetchServerConfig, setRemoteAccess } from '../../data/client'
import { useQuery } from '../../data/hooks'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button'
import { useConfirm } from '../../ui/Feedback'
import { Icon } from '../../ui/Icons'
import { useAction } from './shared'
import styles from './Admin.module.css'

const DISMISS_KEY = 'localreel.lan-card.hidden'

/**
 * The one thing a fresh install cannot discover on its own.
 *
 * Everything else in the console answers a question the owner already has;
 * "your phone can watch this too" is not one of them. The card appears only
 * while the server is loopback-only, says the address it would use, and hides
 * itself for good once dismissed or enabled.
 */
export function LanCard() {
  const t = useT()
  const confirm = useConfirm()
  const action = useAction()
  const config = useQuery('admin:config', fetchServerConfig, { staleTime: 60_000 })
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [saved, setSaved] = useState(false)

  const data = config.data
  if (!data || !data.loopback_only || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // A browser with storage disabled simply sees the card again next time.
    }
  }

  const enable = async () => {
    const ok = await confirm({
      title: t('lanCard.confirmTitle'),
      body: t('settings.server.remote.confirmBody'),
      confirmLabel: t('settings.server.remote.on'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return
    await action.run('lan', async () => {
      await setRemoteAccess(true)
      setSaved(true)
      await config.reload()
    })
  }

  return (
    <section className={styles.lanCard} aria-labelledby="lan-card-title">
      <span className={styles.lanIcon} aria-hidden="true">
        <Icon name="globe" size={18} />
      </span>
      <div className={styles.lanBody}>
        <h2 id="lan-card-title" className={styles.lanTitle}>
          {t('lanCard.title')}
        </h2>
        <p className={styles.lanText}>{t('lanCard.body')}</p>
        {data.lan_address ? (
          <p className={styles.lanAddress}>
            <code>{`http://${data.lan_address}`}</code>
          </p>
        ) : null}
        {saved ? <p className={styles.ok}>{t('settings.server.remote.saved')}</p> : null}
        {action.error ? <p className={styles.error}>{t('lanCard.failed')}</p> : null}
      </div>
      <div className={styles.lanActions}>
        {saved ? (
          <Button variant="ghost" onClick={dismiss}>
            {t('lanCard.dismissSaved')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={dismiss}>
              {t('lanCard.later')}
            </Button>
            <Button
              variant="primary"
              icon="globe"
              loading={action.pending === 'lan'}
              onClick={() => void enable()}
            >
              {t('settings.server.remote.on')}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
