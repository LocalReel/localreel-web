import { useCallback, useEffect, useState } from 'react'

import {
  createShare,
  fetchShares,
  revokeShare,
  type MediaShare,
} from '../../data/client'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Icon } from '../../ui/Icons'
import styles from './ShareDialog.module.css'

type ShareTtl = '24' | '168' | 'never'

/**
 * Creating and revoking links for one item.
 *
 * The only thing worth showing twice is the URL itself, so the dialog keeps one
 * visible copy box and puts the history below it: a link someone forgot about
 * is the reason a revoke button has to exist.
 */
export function ShareDialog({
  mediaId,
  open,
  onClose,
}: {
  mediaId: number
  open: boolean
  onClose: () => void
}) {
  const t = useT()
  const [ttl, setTtl] = useState<ShareTtl>('24')
  const [allowDownload, setAllowDownload] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [created, setCreated] = useState<MediaShare | null>(null)
  const [shares, setShares] = useState<MediaShare[]>([])
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const reload = useCallback(async () => {
    try {
      setShares(await fetchShares(mediaId))
    } catch (problem) {
      setError(problem)
    }
  }, [mediaId])

  useEffect(() => {
    if (!open) return
    setCreated(null)
    setCopied(false)
    setCopyFailed(false)
    setError(null)
    void reload()
  }, [open, reload])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const share = await createShare(mediaId, {
        ttl_hours: ttl === 'never' ? undefined : Number(ttl),
        allow_download: allowDownload,
      })
      setCreated(share)
      setCopied(false)
      setCopyFailed(false)
      await reload()
    } catch (problem) {
      setError(problem)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!created) return
    setCopyFailed(false)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(`${window.location.origin}${created.url}`)
      setCopied(true)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    }
  }

  const revoke = async (token: string) => {
    setBusy(true)
    try {
      await revokeShare(token)
      if (created?.token === token) setCreated(null)
      await reload()
    } catch (problem) {
      setError(problem)
    } finally {
      setBusy(false)
    }
  }

  const when = (seconds: number) => new Date(seconds * 1000).toLocaleString()

  return (
    <Dialog
      open={open}
      title={t('share.dialog.title')}
      description={t('share.dialog.body')}
      onClose={onClose}
      closeLabel={t('common.close')}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className={styles.body}>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="share-ttl">
            {t('share.dialog.ttl')}
          </label>
          <select
            id="share-ttl"
            className={styles.select}
            value={ttl}
            onChange={event => setTtl(event.target.value as ShareTtl)}
          >
            <option value="24">{t('share.dialog.ttl.day')}</option>
            <option value="168">{t('share.dialog.ttl.week')}</option>
            <option value="never">{t('share.dialog.ttl.never')}</option>
          </select>
        </div>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={event => setAllowDownload(event.target.checked)}
          />
          {t('share.dialog.download')}
        </label>

        <div>
          <Button variant="primary" icon="external" loading={busy} onClick={() => void create()}>
            {t('share.dialog.create')}
          </Button>
        </div>

        {error ? <p className={styles.error}>{t('share.dialog.failed')}</p> : null}

        {created ? (
          <div className={styles.created}>
            <p className={styles.createdLabel}>{t('share.dialog.created')}</p>
            <div className={styles.copyRow}>
              <input className={styles.url} readOnly aria-label={t('share.dialog.created')}
                value={`${window.location.origin}${created.url}`} onFocus={event => event.currentTarget.select()} />
              <Button variant="secondary" icon="copy" onClick={() => void copy()}>
                {copied ? t('share.dialog.copied') : t('share.dialog.copy')}
              </Button>
            </div>
            {copyFailed ? <p role="status" className={styles.hint}>{t('share.dialog.copyFailed')}</p> : null}
            {created.expires_at ? (
              <p className={styles.hint}>
                {t('share.dialog.expires', { date: when(created.expires_at) })}
              </p>
            ) : (
              <p className={styles.hint}>{t('share.dialog.noExpiry')}</p>
            )}
          </div>
        ) : null}

        {shares.length > 0 ? (
          <div className={styles.list}>
            <p className={styles.createdLabel}>{t('share.dialog.existing')}</p>
            <ul className={styles.items}>
              {shares.map(share => {
                const active =
                  share.revoked_at == null &&
                  (share.expires_at == null || share.expires_at * 1000 > Date.now())
                return (
                  <li key={share.token} className={styles.item}>
                    <code className={styles.itemToken}>{share.token.slice(0, 8)}</code>
                    <span className={styles.itemWhen}>
                      {share.expires_at
                        ? t('share.dialog.expires', { date: when(share.expires_at) })
                        : t('share.dialog.noExpiry')}
                    </span>
                    {active ? (
                      <button
                        type="button"
                        className={styles.revoke}
                        disabled={busy}
                        onClick={() => void revoke(share.token)}
                      >
                        <Icon name="close" size={13} />
                        {t('share.dialog.revoke')}
                      </button>
                    ) : (
                      <span className={styles.itemWhen}>{t('share.dialog.inactive')}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
