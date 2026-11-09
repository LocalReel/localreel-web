import { thumbnailUrl, thumbnailUrlOf } from '../../data/client'
import type { Media, SeriesSummary } from '../../data/types'
import { useT } from '../../i18n'
import { Link } from '../../app/router'
import { routeHref } from '../../app/match'
import { formatDuration } from '../../lib/format'
import { episodeOf, extensionOf, mediaHeading, mediaSubheading } from '../../lib/text'
import { playedRatio, type ProgressInfo } from './useProgress'
import styles from './Cards.module.css'

export function MediaCard({ media, progress }: { media: Media; progress?: ProgressInfo }) {
  const t = useT()
  const poster = thumbnailUrl(media)
  const ratio = playedRatio(progress)
  const episode = episodeOf(media)
  const heading = mediaHeading(media, t)
  // Only repeat the show name when it is not already the card's heading.
  const showLine =
    media.series_title && media.series_title.trim() !== heading ? media.series_title : null
  // The first line identifies the thing; the second says which episode it is
  // and, when the title was already specific, which show it belongs to.
  const subline =
    episode != null
      ? [t('library.episode', { number: episode }), showLine].filter(Boolean).join(' · ')
      : mediaSubheading(media, t)

  return (
    <Link to={routeHref('watch', { id: media.id })} className={styles.card}>
      <div className={styles.poster}>
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className={styles.placeholder}>{extensionOf(media.filename)}</div>
        )}
        {media.duration ? <span className={styles.duration}>{formatDuration(media.duration)}</span> : null}
        {media.missing_at ? <span className={styles.missing}>{t('library.missing')}</span> : null}
        {ratio != null ? (
          <div className={styles.played} aria-hidden="true">
            <span className={styles.playedFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className={styles.meta}>
        <span className={styles.title} title={heading}>
          {heading}
        </span>
        {subline ? <span className={styles.sub}>{subline}</span> : null}
      </div>
    </Link>
  )
}

export function SeriesCard({ series }: { series: SeriesSummary }) {
  const t = useT()
  const poster = thumbnailUrlOf(series.thumbnail_path)
  const ratio = series.episode_count > 0 ? series.watched_count / series.episode_count : 0

  return (
    <Link to={routeHref('show', { id: series.id })} className={styles.card}>
      <div className={styles.poster}>
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className={styles.placeholder}>{series.title.slice(0, 2)}</div>
        )}
        <span className={styles.count}>{t('show.episodeCount', { count: series.episode_count })}</span>
        {series.watched_count > 0 ? (
          <div className={styles.played} aria-hidden="true">
            <span className={styles.playedFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className={styles.meta}>
        <span className={styles.title} title={series.title}>
          {series.title}
        </span>
        <span className={styles.sub}>
          {t('show.watchedCount', { watched: series.watched_count, total: series.episode_count })}
        </span>
      </div>
    </Link>
  )
}
