import { useEffect, useMemo, useRef, useState } from 'react'

import { fetchMedia } from '../../data/client'
import { useDebounced, useQuery } from '../../data/hooks'
import type { Media, MediaFilter } from '../../data/types'
import { useT } from '../../i18n'
import { Link, useQueryParam } from '../../app/router'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icons'
import { PageHeader } from '../../ui/PageHeader'
import { Tabs } from '../../ui/Tabs'
import { Spinner } from '../../ui/Spinner'
import { MediaCard } from './Cards'
import cards from './Cards.module.css'
import { useProgressIndex } from './useProgress'
import styles from './Library.module.css'

const PAGE_SIZE = 60

/**
 * The full catalogue, one file per card.
 *
 * Home answers "what next"; this page answers "everything, findable". It is the
 * only surface that still lists files rather than shows, which is what a viewer
 * needs when the scanner could not group something.
 */
export function LibraryPage() {
  const t = useT()
  const [query, setQuery] = useQueryParam('q')
  const [filterParam, setFilterParam] = useQueryParam('filter')
  const [archivedParam, setArchivedParam] = useQueryParam('archived')

  const [draft, setDraft] = useState(query ?? '')
  const debounced = useDebounced(draft, 250)
  const filter = (filterParam as MediaFilter) ?? 'all'
  const includeArchived = archivedParam === '1'
  const progress = useProgressIndex()

  // Keep the box in sync when the URL changes underneath (back button, link).
  useEffect(() => {
    setDraft(query ?? '')
  }, [query])

  useEffect(() => {
    const next = debounced.trim()
    if ((query ?? '') === next) return
    setQuery(next || null)
  }, [debounced, query, setQuery])

  const key = `media:list:${query ?? ''}:${filter}:${includeArchived ? '1' : '0'}`
  const first = useQuery<{ items: Media[]; total: number; next_cursor: number | null }>(
    key,
    () =>
      fetchMedia({
        q: query ?? undefined,
        filter,
        limit: PAGE_SIZE,
        offset: 0,
        include_archived: includeArchived,
      }),
    { staleTime: 20_000 },
  )

  const [extra, setExtra] = useState<Media[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const generation = useRef(0)

  // A new query/filter starts a new list; appended pages belong to the old one.
  useEffect(() => {
    generation.current += 1
    setLoadingMore(false)
    setExtra([])
    setMoreError(null)
  }, [key])

  const items = useMemo(
    () => [...(first.data?.items ?? []), ...extra],
    [first.data?.items, extra],
  )
  const total = first.data?.total ?? 0
  const hasMore = items.length < total

  const loadMore = async () => {
    const ticket = generation.current
    setLoadingMore(true)
    setMoreError(null)
    try {
      const next = await fetchMedia({
        q: query ?? undefined,
        filter,
        limit: PAGE_SIZE,
        offset: items.length,
        include_archived: includeArchived,
      })
      if (generation.current !== ticket) return
      setExtra(current => [...current, ...next.items])
    } catch (error) {
      if (generation.current === ticket) {
        setMoreError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (generation.current === ticket) setLoadingMore(false)
    }
  }

  const searching = (query ?? '').trim().length > 0
  const filtered = filter !== 'all' || includeArchived

  return (
    <>
      <PageHeader
        kicker={t('nav.library')}
        title={t('library.title')}
        note={t('library.subtitle', { count: total })}
      />

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon name="search" size={16} />
          <input
            id="library-search"
            name="q"
            type="search"
            value={draft}
            placeholder={t('library.search')}
            aria-label={t('library.search')}
            onChange={event => setDraft(event.target.value)}
          />
          {draft ? (
            <button
              type="button"
              className={styles.clear}
              aria-label={t('common.close')}
              onClick={() => setDraft('')}
            >
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </div>

        <Tabs
          label={t('library.title')}
          value={filter}
          onChange={next => setFilterParam(next === 'all' ? null : next)}
          items={[
            { id: 'all', label: t('library.filter.all') },
            { id: 'continue', label: t('library.filter.continue') },
            { id: 'favorites', label: t('library.filter.favorites') },
          ]}
        />

        <button
          type="button"
          className={styles.toggle}
          aria-pressed={includeArchived}
          onClick={() => setArchivedParam(includeArchived ? null : '1')}
        >
          <Icon name="folder" size={15} />
          {t('library.filter.archived')}
        </button>
      </div>

      {first.error ? (
        <Empty
          title={t('common.error')}
          body={first.error instanceof Error ? first.error.message : String(first.error)}
          action={
            <Button variant="secondary" icon="refresh" onClick={() => first.reload()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}

      {first.loading && !first.data ? (
        <div className={styles.state}>
          <Spinner large />
          <p>{t('common.loading')}</p>
        </div>
      ) : null}

      {!first.loading && items.length === 0 ? (
        <Empty
          title={searching ? t('library.empty.noResults', { query: query ?? '' }) : t('library.empty.title')}
          body={searching ? t('library.empty.noResultsBody') : t('library.empty.body')}
          action={
            searching || filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft('')
                  setQuery(null)
                  setFilterParam(null)
                  setArchivedParam(null)
                }}
              >
                {t('library.empty.clear')}
              </Button>
            ) : (
              <Link to="/admin/sources">
                <Button variant="primary" icon="folder">
                  {t('home.empty.action')}
                </Button>
              </Link>
            )
          }
        />
      ) : null}

      {items.length > 0 ? (
        <div className={cards.grid}>
          {items.map(media => (
            <MediaCard key={media.id} media={media} progress={progress.get(media.id)} />
          ))}
        </div>
      ) : null}

      {hasMore && items.length > 0 ? (
        <div className={styles.more}>
          <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? t('library.loadingMore') : t('library.loadMore')}
          </Button>
        </div>
      ) : null}

      {moreError ? <Empty title={t('common.error')} body={moreError} /> : null}
    </>
  )
}
