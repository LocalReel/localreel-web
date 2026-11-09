import { fetchSeriesDetail, thumbnailUrlOf } from '../../data/client'
import { useQuery } from '../../data/hooks'
import { Link } from '../../app/router'
import { routeHref } from '../../app/match'
import { navigate } from '../../app/router'
import { useT } from '../../i18n'
import { formatDuration } from '../../lib/format'
import { episodeHeading, mediaHeading } from '../../lib/text'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { Spinner } from '../../ui/Spinner'
import { playedRatio, useProgressIndex } from '../library/useProgress'
import styles from './Show.module.css'

/**
 * One show: every episode the scanner grouped under the same folder, plus a
 * single obvious "continue" action so the viewer never has to work out which
 * episode they were on.
 */
export function ShowPage({ id }: { id: string }) {
  const t = useT()
  const detail = useQuery(`series:${id}`, () => fetchSeriesDetail(id), { staleTime: 60_000 })
  const progress = useProgressIndex()

  if (detail.loading && !detail.data) {
    return (
      <div className={styles.hero}>
        <Spinner large />
      </div>
    )
  }

  if (detail.error || !detail.data) {
    return (
      <Empty
        title={t('common.error')}
        body={detail.error instanceof Error ? detail.error.message : undefined}
        action={
          <Link to="/library">
            <Button variant="secondary" icon="chevron-left">
              {t('notfound.action')}
            </Button>
          </Link>
        }
      />
    )
  }

  const { series, episodes } = detail.data
  const poster = thumbnailUrlOf(series.thumbnail_path)
  const watchedRatio = series.episode_count > 0 ? series.watched_count / series.episode_count : 0
  const nextEpisode =
    episodes.find(entry => {
      const state = progress.get(entry.id)
      if (!state) return false
      return state.position > 0 && !state.finished
    }) ?? episodes.find(entry => !progress.get(entry.id)?.finished) ?? episodes[0]

  const resumeState = nextEpisode ? progress.get(nextEpisode.id) : undefined
  const resumeLabel =
    resumeState && resumeState.position > 0
      ? t('show.resume', { number: nextEpisode?.episode ?? 1 })
      : t('show.play')

  return (
    <>
      <Link to="/library" className={styles.back}>
        <Icon name="chevron-left" size={16} />
        {t('show.back')}
      </Link>

      <header className={styles.hero}>
        <div className={styles.poster}>
          {poster ? (
            <img src={poster} alt="" />
          ) : (
            <div className={styles.placeholder}>{series.title.slice(0, 2)}</div>
          )}
        </div>
        <div className={styles.heroText}>
          <h1 className={styles.title}>{series.title}</h1>
          <div className={styles.meta}>
            <span>{t('show.episodeCount', { count: series.episode_count })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('show.watchedCount', { watched: series.watched_count, total: series.episode_count })}</span>
          </div>
          {series.watched_count > 0 ? (
            <div className={styles.progressLine}>
              <div className={styles.track} aria-hidden="true">
                <span className={styles.trackFill} style={{ width: `${Math.round(watchedRatio * 100)}%` }} />
              </div>
              <span>{Math.round(watchedRatio * 100)}%</span>
            </div>
          ) : null}
          <div className={styles.actions}>
            {nextEpisode ? (
              <Button
                variant="primary"
                size="lg"
                icon="play"
                onClick={() => navigate(routeHref('watch', { id: nextEpisode.id }))}
              >
                {resumeLabel}
              </Button>
            ) : null}
            <Button variant="secondary" size="lg" icon="reels" onClick={() => navigate('/reels')}>
              {t('home.reelsCta')}
            </Button>
          </div>
        </div>
      </header>

      <section aria-label={t('show.episodes')}>
        <div className={styles.list}>
          {episodes.map(episode => {
            const state = progress.get(episode.id)
            const ratio = playedRatio(state)
            const heading = episodeHeading(episode, t)
            const cleaned = episode.title ? mediaHeading(episode, t) : ''
            // Untitled episodes fall back to the file stem, which for most
            // releases is just the number again ("01"); show the localized
            // episode label instead of repeating the rail number.
            const meaningful = cleaned && !/^\d+$/.test(cleaned) ? cleaned : ''
            const title =
              meaningful || (episode.episode != null ? t('library.episode', { number: episode.episode }) : heading)
            return (
              <Link
                key={episode.id}
                to={routeHref('watch', { id: episode.id })}
                className={styles.row}
              >
                <span className={styles.number}>
                  {episode.episode != null ? String(episode.episode).padStart(2, '0') : '—'}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{title}</span>
                  <span className={styles.rowSub}>
                    {formatDuration(episode.duration)}
                    {episode.missing_at ? ` · ${t('show.missing')}` : ''}
                  </span>
                  {ratio != null ? (
                    <span className={styles.miniBar} aria-hidden="true">
                      <span className={styles.miniFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
                    </span>
                  ) : null}
                </span>
                <span className={styles.rowPlay} aria-hidden="true">
                  <Icon name="play" size={14} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}
