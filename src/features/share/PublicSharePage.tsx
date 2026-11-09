import { useEffect, useState } from 'react'

import { Icon } from '../../ui/Icons'
import { Spinner } from '../../ui/Spinner'
import { useT } from '../../i18n'
import styles from './Share.module.css'

export interface PublicShare {
  title: string
  filename: string
  duration: number | null
  width: number | null
  height: number | null
  series_title: string | null
  episode: number | null
  allow_download: boolean
  expires_at: number | null
  stream: string
  /** Present only when the link allows saving the file. */
  download: string | null
}

/**
 * The page behind a share link.
 *
 * Deliberately outside the signed-in application: no rail, no account menu and
 * no session calls. It talks to one endpoint and plays one file, which is the
 * whole promise of a link.
 */
export function PublicSharePage({ token }: { token: string }) {
  const t = useT()
  const [state, setState] = useState<
    { phase: 'loading' } | { phase: 'ready'; share: PublicShare } | { phase: 'gone' } | { phase: 'error' }
  >({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/share/${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } })
      .then(async response => {
        if (cancelled) return
        if (response.status === 404) {
          setState({ phase: 'gone' })
          return
        }
        if (!response.ok) {
          setState({ phase: 'error' })
          return
        }
        setState({ phase: 'ready', share: (await response.json()) as PublicShare })
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.head}>
          <span className={styles.kicker}>{t('home.kicker')}</span>
          <span className={styles.brand}>LocalReel</span>
        </header>

        {state.phase === 'loading' ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : state.phase === 'gone' ? (
          <div className={styles.notice}>
            <Icon name="alert" size={18} />
            <p>{t('share.gone')}</p>
          </div>
        ) : state.phase === 'error' ? (
          <div className={styles.notice}>
            <Icon name="alert" size={18} />
            <p>{t('share.error')}</p>
          </div>
        ) : (
          <>
            <video
              className={styles.video}
              src={state.share.stream}
              controls
              preload="metadata"
              controlsList={state.share.allow_download ? undefined : 'nodownload'}
            />
            <div className={styles.meta}>
              <h1 className={styles.title}>
                {state.share.series_title && state.share.episode
                  ? `${state.share.series_title} · ${t('library.episode', { number: state.share.episode })}`
                  : state.share.title}
              </h1>
              <p className={styles.sub}>
                {state.share.width && state.share.height
                  ? `${state.share.width}×${state.share.height}`
                  : null}
                {state.share.expires_at
                  ? ` · ${t('share.expires', { date: new Date(state.share.expires_at * 1000).toLocaleDateString() })}`
                  : null}
              </p>
              {state.share.download ? (
                <a className={styles.download} href={state.share.download}>
                  <Icon name="download" size={14} />
                  {t('share.download')}
                </a>
              ) : null}
            </div>
          </>
        )}

        <footer className={styles.foot}>{t('share.footer')}</footer>
      </div>
    </main>
  )
}
