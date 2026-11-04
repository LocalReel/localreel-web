/**
 * Pure helpers for the scroll feed (Reels).
 *
 * Everything here is deliberately free of React and DOM access so it can be
 * unit-tested with `node --test`. The rest is formatting, list bookkeeping and
 * gesture classification.
 */
import type { FeedItem, Media } from './api'

/**
 * Largest width/height ratio that is still shown full-bleed.
 *
 * Only portrait or square clips fill the screen. A 16:9 episode inside a
 * 390×844 viewport would keep roughly a quarter of its width when cropped, so
 * landscape video is letterboxed instead — the frame is the content.
 */
export const COVER_MAX_ASPECT = 1.05

export type ObjectFit = 'cover' | 'contain'

/** Pick `object-fit` for a video frame from its intrinsic pixel size. */
export function objectFitForVideo(width: number, height: number): ObjectFit {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'contain'
  }
  return width / height <= COVER_MAX_ASPECT ? 'cover' : 'contain'
}

/**
 * Pick `object-fit` straight from a feed item (the API exposes ffprobe
 * dimensions). Falls back to the non-cropping mode when they are unknown; the
 * video element corrects this from its own metadata once it loads.
 */
export function objectFitForFeedItem(item: Pick<FeedItem, 'width' | 'height'>): ObjectFit {
  if (item.width == null || item.height == null) return 'contain'
  return objectFitForVideo(item.width, item.height)
}

/**
 * Human clock for a media position: `m:ss`, or `h:mm:ss` from one hour up.
 * Invalid input renders the same placeholder the rest of the UI uses.
 */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const restLabel = String(rest).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${restLabel}`
  return `${minutes}:${restLabel}`
}

/** Fraction of the video already played, clamped to 0..1 for the progress bar. */
export function progressRatio(position: number, duration: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(duration)) return 0
  if (duration <= 0 || position <= 0) return 0
  return Math.min(1, position / duration)
}

export type SwipeDirection = 'next' | 'prev'

/**
 * Classify a pointer drag as a vertical swipe. Horizontal-dominant drags are
 * not swipes (the progress bar uses that axis for seeking), and short drags are
 * taps. Swiping up means "next", swiping down means "previous".
 */
export function swipeDirection(
  dx: number,
  dy: number,
  threshold = 60,
): SwipeDirection | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (Math.abs(dy) < threshold) return null
  if (Math.abs(dy) <= Math.abs(dx)) return null
  return dy < 0 ? 'next' : 'prev'
}

/** Index of `id` in `items`, or -1. */
export function indexOfId(items: ReadonlyArray<{ id: number }>, id: number): number {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].id === id) return index
  }
  return -1
}

/**
 * Append feed items that are not loaded yet, keeping the server order of both
 * lists. Returns the same array reference when nothing new arrived, so React
 * state updates can bail out.
 */
export function mergeFeedItems(current: FeedItem[], incoming: FeedItem[]): FeedItem[] {
  if (incoming.length === 0) return current
  const known = new Set(current.map(item => item.id))
  const extra = incoming.filter(item => !known.has(item.id))
  if (extra.length === 0) return current
  return [...current, ...extra]
}

/**
 * Indexes to keep warm around the active slide: the active one plus `ahead`
 * following slides. Clamped to the loaded range; empty for an empty feed.
 */
export function preloadIndexes(length: number, active: number, ahead = 2): number[] {
  if (!Number.isInteger(length) || length <= 0) return []
  const start = Math.max(0, Math.min(length - 1, Math.trunc(active)))
  const last = Math.min(length - 1, start + Math.max(0, Math.trunc(ahead)))
  const indexes: number[] = []
  for (let index = start; index <= last; index += 1) indexes.push(index)
  return indexes
}

/**
 * How many slides ahead to prepare.
 *
 * A full re-encode of a long episode costs minutes of CPU, so a transient
 * neighbour two slides away is not worth preparing ahead of time; direct play
 * and remux are cheap and can be warmed two ahead.
 */
export function preloadAhead(
  items: ReadonlyArray<Pick<FeedItem, 'playback'>>,
  active: number,
  defaultAhead = 2,
): number {
  const second = items[active + 2]
  if (second && second.playback === 'transcode') return Math.min(defaultAhead, 1)
  return defaultAhead
}

/** Strip release tags from a raw name for display: `[Group] Show [01][1080p]` → `Show`. */
export function cleanDisplayTitle(raw: string): string {
  let text = raw.replace(/\.[a-z0-9]{2,5}$/i, ' ')
  let previous = ''
  while (text !== previous) {
    previous = text
    text = text.replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
  }
  return text.split(/\s+/).filter(Boolean).join(' ').trim()
}

/**
 * Title shown in the info layer: cleaned stored title, then the cleaned file
 * name, then the series folder name (a folder-named movie), then the raw stem.
 */
export function feedDisplayTitle(
  item: Pick<FeedItem, 'title' | 'filename' | 'series_title'>,
): string {
  const fromTitle = item.title ? cleanDisplayTitle(item.title) : ''
  if (fromTitle) return fromTitle
  const fromFile = cleanDisplayTitle(item.filename)
  if (fromFile) return fromFile
  const series = item.series_title?.trim()
  if (series) return series
  return item.filename.replace(/\.[a-z0-9]{2,5}$/i, '')
}

/** Thumbnail URL for a feed item's blurred backdrop, or null when it has none. */
export function feedThumbnailUrl(item: Pick<FeedItem, 'thumbnail_path'>): string | null {
  if (!item.thumbnail_path) return null
  return `/thumbnails/${encodeURIComponent(item.thumbnail_path)}`
}

/**
 * Minimal feed item for a `next_id` that was not part of the loaded feed. The
 * single-media endpoint has no series metadata, so this plays the file but does
 * not know about further episodes.
 */
export function feedItemFromMedia(
  media: Pick<Media, 'id' | 'title' | 'filename' | 'duration' | 'width' | 'height' | 'thumbnail_path'>,
): FeedItem {
  return {
    id: media.id,
    title: media.title,
    filename: media.filename,
    series_key: null,
    series_title: null,
    episode: null,
    width: media.width,
    height: media.height,
    duration: media.duration ?? 0,
    position: 0,
    finished: false,
    favorite: false,
    liked: false,
    playback: 'direct',
    next_id: null,
    created_at: 0,
    thumbnail_path: media.thumbnail_path,
  }
}
