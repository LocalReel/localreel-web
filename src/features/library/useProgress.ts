import { useMemo } from 'react'

import { fetchFeed } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { FeedItem } from '../../data/types'

export interface ProgressInfo {
  position: number
  duration: number
  favorite: boolean
  liked: boolean
  finished: boolean
  episode: number | null
  seriesTitle: string | null
}

/**
 * Per-item watch state, borrowed from the ranked feed.
 *
 * The media list deliberately carries no per-account state (a viewer sees the
 * same library as everyone else), and the feed is the one endpoint that joins
 * the two. Its first page is ranked by "what to watch next", so the items with
 * progress are inside the 200-item window; a card whose item is not in the
 * window simply renders without a progress bar instead of guessing.
 */
export function useProgressIndex(): Map<number, ProgressInfo> {
  const { data } = useQuery('feed:200', () => fetchFeed(200), { staleTime: 30_000 })
  return useMemo(() => {
    const index = new Map<number, ProgressInfo>()
    for (const item of data?.items ?? []) {
      index.set(item.id, {
        position: item.position,
        duration: item.duration,
        favorite: item.favorite,
        liked: item.liked,
        finished: item.finished,
        episode: item.episode,
        seriesTitle: item.series_title,
      })
    }
    return index
  }, [data])
}

/** Fraction watched, 0–1, for the thin bar under a poster. */
export function playedRatio(info: ProgressInfo | undefined): number | null {
  if (!info || info.position <= 0 || info.duration <= 0) return null
  if (info.finished) return 1
  return Math.min(1, info.position / info.duration)
}

export type FeedProgress = Map<number, ProgressInfo>
export type FeedItemRow = FeedItem
