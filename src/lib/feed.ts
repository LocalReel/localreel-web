/**
 * Pure helpers for the vertical feed: framing, gesture classification and
 * preload policy. Framework-free so `node --test` can cover them.
 */

/** Widest frame still shown full-bleed; anything wider is letterboxed. */
export const COVER_MAX_ASPECT = 1.05

/** Frames wider than this get a fullscreen affordance. */
export const LANDSCAPE_MIN_ASPECT = 1.2

export type ObjectFit = 'cover' | 'contain'

export function objectFitForVideo(width: number, height: number): ObjectFit {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'contain'
  }
  return width / height <= COVER_MAX_ASPECT ? 'cover' : 'contain'
}

/** The same choice straight from a feed item; unknown sizes never crop. */
export function objectFitForFeedItem(item: { width: number | null; height: number | null }): ObjectFit {
  if (item.width == null || item.height == null) return 'contain'
  return objectFitForVideo(item.width, item.height)
}

export function isLandscape(width: number | null, height: number | null): boolean {
  if (width == null || height == null) return false
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false
  return width / height >= LANDSCAPE_MIN_ASPECT
}

export type SwipeDirection = 'next' | 'prev'

/** A vertical drag long enough to count as a swipe; horizontal drags are not. */
export function swipeDirection(dx: number, dy: number, threshold = 60): SwipeDirection | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (Math.abs(dy) < threshold) return null
  if (Math.abs(dy) <= Math.abs(dx)) return null
  return dy < 0 ? 'next' : 'prev'
}

/** Whether a press sits in the right third, the "hold for 2×" zone. */
export function inSpeedZone(
  clientX: number,
  rect: { left: number; width: number },
  share = 2 / 3,
): boolean {
  if (!Number.isFinite(clientX) || !Number.isFinite(rect.left) || rect.width <= 0) return false
  return clientX >= rect.left + rect.width * share
}

/** Fraction played, clamped to 0..1. */
export function progressRatio(position: number, duration: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(duration)) return 0
  if (duration <= 0 || position <= 0) return 0
  return Math.min(1, position / duration)
}

/** Index of `id` in `items`, or -1. */
export function indexOfId(items: ReadonlyArray<{ id: number }>, id: number): number {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].id === id) return index
  }
  return -1
}

/** Append unseen items, keeping the server's order within each list. */
export function mergeFeedItems<T extends { id: number }>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return current
  const known = new Set(current.map(item => item.id))
  const extra = incoming.filter(item => !known.has(item.id))
  if (extra.length === 0) return current
  return [...current, ...extra]
}

/** Indexes to keep warm around the active slide. */
export function preloadIndexes(length: number, active: number, ahead = 2): number[] {
  if (!Number.isInteger(length) || length <= 0) return []
  const start = Math.max(0, Math.min(length - 1, Math.trunc(active)))
  const last = Math.min(length - 1, start + Math.max(0, Math.trunc(ahead)))
  const indexes: number[] = []
  for (let index = start; index <= last; index += 1) indexes.push(index)
  return indexes
}

/**
 * How many slides ahead to prepare: a full re-encode costs minutes, so a
 * transcode two slides out is not worth warming.
 */
export function preloadAhead(
  items: ReadonlyArray<{ playback: string }>,
  active: number,
  defaultAhead = 2,
): number {
  const second = items[active + 2]
  if (second && second.playback === 'transcode') return Math.min(defaultAhead, 1)
  return defaultAhead
}
