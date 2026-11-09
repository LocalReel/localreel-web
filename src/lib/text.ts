import type { TranslationKey } from '../i18n/dict.en'
import type { Media } from '../data/types'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/** Strip the extension, then remove bracketed release groups and tags. */
export function cleanTitle(raw: string): string {
  let text = raw.replace(/\.[a-z0-9]{2,5}$/i, ' ')
  let previous = ''
  while (text !== previous) {
    previous = text
    text = text.replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
  }
  return text
    .replace(/[_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .trim()
}

/** File extension, upper-cased, for the poster placeholder. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0 || dot === filename.length - 1) return 'FILE'
  return filename.slice(dot + 1).toUpperCase()
}

/** Episode number from the server, falling back to the file name. */
export function episodeOf(media: Pick<Media, 'episode' | 'filename'>): number | null {
  if (typeof media.episode === 'number' && Number.isFinite(media.episode)) return media.episode
  const match = /\b(?:e|ep|第)?\s?(\d{1,3})\s?(?:话|集|\[|\.|$)/i.exec(
    media.filename.replace(/\.[a-z0-9]{2,5}$/i, ''),
  )
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * The one line a card shows as its title.
 *
 * Preference order: the stored title, then the show name (with the episode in
 * the subheading), then the cleaned file name. A name made entirely of release
 * tags has nothing left after cleaning, so it falls back to the raw stem rather
 * than to an empty card.
 */
export function mediaHeading(
  media: Pick<Media, 'title' | 'filename' | 'series_title'>,
  t: Translate,
): string {
  const stored = media.title ? cleanTitle(media.title) : ''
  if (stored) return stored
  if (media.series_title && media.series_title.trim()) return media.series_title.trim()
  const fromFile = cleanTitle(media.filename)
  if (fromFile) return fromFile
  return media.filename.replace(/\.[a-z0-9]{2,5}$/i, '')
}

/** The dim line under a card title: episode number, or codec and size. */
export function mediaSubheading(
  media: Pick<Media, 'episode' | 'series_title' | 'video_codec' | 'width' | 'height'>,
  t: Translate,
): string | null {
  const episode = episodeOf(media as Pick<Media, 'episode' | 'filename'>)
  if (media.series_title && episode != null) {
    return t('library.episode', { number: episode })
  }
  const parts: string[] = []
  if (media.video_codec) parts.push(media.video_codec)
  if (media.width && media.height) parts.push(`${media.width}×${media.height}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Episode label with the title folded in, for a page heading. */
export function episodeHeading(media: Pick<Media, 'episode' | 'title' | 'filename'>, t: Translate): string {
  const episode = episodeOf(media as Pick<Media, 'episode' | 'filename'>)
  const title = media.title ? cleanTitle(media.title) : ''
  // Release names usually already carry the episode number ("第06话 …"), so a
  // second prefix would read as "第 6 集 · 第06话 …".
  if (title) return title
  if (episode != null) return t('library.episode', { number: episode })
  return cleanTitle(media.filename) || media.filename
}
