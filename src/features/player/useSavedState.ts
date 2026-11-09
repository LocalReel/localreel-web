import { useCallback } from 'react'

import { fetchState, saveState, saveStateKeepalive, type StatePatch } from '../../data/client'
import { cache } from '../../data/cache'
import { useQuery } from '../../data/hooks'
import type { MediaState } from '../../data/types'

/**
 * The signed-in account's state for one media item.
 *
 * Writes are optimistic: the cache is patched first so a like flips instantly,
 * then the server answer replaces it. A failed write is swallowed — the next
 * read repairs the value — because a dropped like must never block playback.
 */
export function useSavedState(mediaId: number) {
  const query = useQuery(`state:${mediaId}`, () => fetchState(mediaId), { staleTime: 10_000 })
  const key = `state:${mediaId}`

  const save = useCallback(
    (patch: StatePatch) => {
      cache.patch<MediaState>(key, current => ({
        user_id: current?.user_id ?? 0,
        media_id: mediaId,
        liked: current?.liked ?? false,
        favorite: current?.favorite ?? false,
        position: current?.position ?? 0,
        duration: current?.duration ?? 0,
        updated_at: Math.floor(Date.now() / 1000),
        ...patch,
      }))
      void saveState(mediaId, patch)
        .then(next => cache.put(key, next))
        .catch(() => {
          // Best effort: the next read repairs the value.
        })
    },
    [key, mediaId],
  )

  /** Write the last position even if the page is unloading. */
  const flush = useCallback(
    (position: number, duration: number) => {
      if (!Number.isFinite(position) || position <= 0) return
      saveStateKeepalive(mediaId, {
        position,
        duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      })
    },
    [mediaId],
  )

  const toggleLike = useCallback(() => {
    const current = cache.get<MediaState>(key)
    const liked = current.status === 'success' ? !current.data?.liked : true
    save({ liked })
  }, [key, save])

  const toggleFavorite = useCallback(() => {
    const current = cache.get<MediaState>(key)
    const favorite = current.status === 'success' ? !current.data?.favorite : true
    save({ favorite })
  }, [key, save])

  return {
    state: query.data,
    loading: query.loading,
    save,
    flush,
    toggleLike,
    toggleFavorite,
  }
}
