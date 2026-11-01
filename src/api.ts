export interface Media {
  id: number
  uid: string
  source_id: number
  uri: string
  filename: string
  title: string | null
  duration: number | null
  width: number | null
  height: number | null
  video_codec: string | null
  audio_codec: string | null
  thumbnail_path: string | null
  missing_at: number | null
}

export interface MediaPage {
  items: Media[]
  total: number
  next_cursor: number | null
}

export interface Playback {
  mode: 'direct' | 'ready' | 'preparing' | 'failed'
  url?: string
  job_id?: string
  message?: string
}

export type MediaFilter = 'all' | 'favorites' | 'continue'

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = (await response.json()) as ApiErrorBody
      if (body.error?.message) message = body.error.message
    } catch {
      // keep the status-based message
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function fetchMedia(params: {
  q?: string
  filter?: MediaFilter
  limit?: number
  offset?: number
  source_id?: number
}): Promise<MediaPage> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.filter && params.filter !== 'all') search.set('filter', params.filter)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  if (params.source_id) search.set('source_id', String(params.source_id))
  const suffix = search.toString()
  return request<MediaPage>(`/api/v1/media${suffix ? `?${suffix}` : ''}`)
}

export function preparePlayback(id: number): Promise<Playback> {
  return request<Playback>(`/api/v1/media/${id}/playback`, { method: 'POST' })
}

export function thumbnailUrl(media: Media): string | null {
  if (!media.thumbnail_path) return null
  return `/thumbnails/${encodeURIComponent(media.thumbnail_path)}`
}

export function streamUrl(id: number): string {
  return `/api/v1/media/${id}/stream`
}

export function displayTitle(media: Media): string {
  return media.title || media.filename.replace(/\.[a-z0-9]{2,5}$/i, '')
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}
