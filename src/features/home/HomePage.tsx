import { routeHref } from '../../app/match'
import { Link } from '../../app/router'
import { fetchFeed, fetchMedia, fetchSeries, thumbnailUrlOf } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { FeedItem } from '../../data/types'
import { useT } from '../../i18n'
import { formatDuration, watchedPercent } from '../../lib/format'
import { episodeHeading } from '../../lib/text'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { PageHeader, SectionTitle } from '../../ui/PageHeader'
import { MediaCard, SeriesCard } from '../library/Cards'
import cards from '../library/Cards.module.css'
import { useProgressIndex } from '../library/useProgress'
import styles from './Home.module.css'

/**
 * Landing surface: keep watching, then shows, then what is new.
 *
 * The order answers the three questions a household actually has — "what was I
 * in the middle of", "what shows do I have", "what arrived" — instead of
 * showing one flat catalogue.
 */
export function HomePage() {
  const t = useT()
  const progress = useProgressIndex()
  const feed = useQuery('feed:200', () => fetchFeed(200), { staleTime: 30_000 })
  const series = useQuery('series', fetchSeries, { staleTime: 60_000 })
  const recent = useQuery('media:recent', () => fetchMedia({ limit: 12 }), { staleTime: 30_000 })

  const items = feed.data?.items ?? []
  const continuing = items.filter(item => item.position > 0 && !item.finished).slice(0, 10)
  const shows = series.data?.items.slice(0, 8) ?? []
  const newest = recent.data?.items ?? []
  const emptyLibrary = !feed.loading && !recent.loading && items.length === 0 && newest.length === 0

  if (emptyLibrary) {
    return (
      <>
        <PageHeader kicker={t('home.kicker')} title={t('home.title')} note={t('home.empty.body')} />
        <Empty
          title={t('home.empty.title')}
          body={t('home.empty.body')}
          action={
            <Link to="/admin/sources">
              <Button variant="primary" icon="plus">
                {t('home.empty.action')}
              </Button>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker={t('home.kicker')}
        title={t('home.title')}
        note={t('home.subtitle')}
        actions={
          <Link to="/library">
            <Button variant="secondary" iconAfter="chevron-right">
              {t('library.title')}
            </Button>
          </Link>
        }
      />

      {continuing.length > 0 ? (
        <section aria-labelledby="continue-heading">
          <SectionTitle title={<span id="continue-heading">{t('home.continue')}</span>} />
          <div className={cards.rail}>
            {continuing.map(item => (
              <ContinueCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {shows.length > 0 ? (
        <section aria-labelledby="shows-heading">
          <SectionTitle
            title={<span id="shows-heading">{t('home.shows')}</span>}
            action={
              <Link to="/library" className={styles.railSub}>
                {t('home.viewAll')}
              </Link>
            }
          />
          <div className={cards.grid}>
            {shows.map(entry => (
              <SeriesCard key={entry.id} series={entry} />
            ))}
          </div>
        </section>
      ) : null}

      {newest.length > 0 ? (
        <section aria-labelledby="recent-heading">
          <SectionTitle title={<span id="recent-heading">{t('home.recent')}</span>} />
          <div className={cards.grid}>
            {newest.map(media => (
              <MediaCard key={media.id} media={media} progress={progress.get(media.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.promo} aria-label={t('home.reelsCta')}>
        <div className={styles.promoText}>
          <p className={styles.promoTitle}>{t('home.reelsCta')}</p>
          <p className={styles.promoNote}>{t('home.reelsHint')}</p>
        </div>
        <Link to="/reels">
          <Button variant="primary" icon="play">
            {t('home.reelsCta')}
          </Button>
        </Link>
      </section>
    </div>
  )
}

function ContinueCard({ item }: { item: FeedItem }) {
  const t = useT()
  const poster = thumbnailUrlOf(item.thumbnail_path)
  const percent = watchedPercent(item.position, item.duration)
  const remaining = Math.max(0, item.duration - item.position)

  return (
    <Link to={routeHref('watch', { id: item.id })} className={styles.railCard}>
      <div className={styles.railPoster}>
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className={styles.railPlaceholder}>
            <Icon name="film" size={24} />
          </div>
        )}
        <span className={styles.remaining}>{formatDuration(remaining)}</span>
        <div className={styles.played} aria-hidden="true">
          <span className={styles.playedFill} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className={styles.railMeta}>
        <span className={styles.railTitle}>{item.series_title ?? episodeHeading(item, t)}</span>
        <span className={styles.railSub}>
          {t('library.progress', { percent })}
          {item.episode != null ? ` · ${t('library.episode', { number: item.episode })}` : ''}
        </span>
      </div>
    </Link>
  )
}
