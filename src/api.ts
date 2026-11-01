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

export interface MediaState {
  media_id: number
  liked: boolean
  favorite: boolean
  position: number
  duration: number
  updated_at: number
}

export interface Source {
  id: number
  uri: string
  kind: string
  enabled: boolean
  created_at: number
  updated_at: number
}

export interface JobRecord {
  id: string
  kind: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
  progress: number
  attempts: number
  max_attempts: number
  error: string | null
  created_at: number
  updated_at: number
}

export interface ScanRun {
  id: number
  source_id: number
  source_uri: string
  started_at: number
  finished_at: number | null
  status: string
  discovered: number
  added: number
  updated: number
  unchanged: number
  removed: number
  failed: number
}

export interface CacheStats {
  transcode_count: number
  transcode_bytes: number
  thumbnail_count: number
  thumbnail_bytes: number
  total_bytes: number
}

export interface CacheGcReport {
  removed: number
  freed_bytes: number
  kept: number
  remaining_bytes: number
}

export interface AdminHealth {
  status: string
  version: string
  database: boolean
  ffmpeg: boolean
  media_count: number
  data_dir: string
  thumbnail_dir: string
  transcode_dir: string
  jobs: JobRecord[]
}

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

export function fetchState(id: number): Promise<MediaState> {
  return request<MediaState>(`/api/v1/media/${id}/state`)
}

export function saveState(
  id: number,
  patch: { position?: number; duration?: number; liked?: boolean; favorite?: boolean },
): Promise<MediaState> {
  return request<MediaState>(`/api/v1/media/${id}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export function fetchAdminHealth(): Promise<AdminHealth> {
  return request<AdminHealth>('/api/v1/admin/health')
}

export function fetchSources(): Promise<Source[]> {
  return request<Source[]>('/api/v1/sources')
}

export function fetchJobs(limit = 20): Promise<JobRecord[]> {
  return request<JobRecord[]>(`/api/v1/jobs?limit=${limit}`)
}

export function fetchScanRuns(limit = 20): Promise<ScanRun[]> {
  return request<ScanRun[]>(`/api/v1/scan-runs?limit=${limit}`)
}

export function fetchCacheStats(): Promise<CacheStats> {
  return request<CacheStats>('/api/v1/admin/cache')
}

export function runCacheGc(): Promise<CacheGcReport> {
  return request<CacheGcReport>('/api/v1/admin/cache/gc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export function setSourceEnabled(sourceId: number, enabled: boolean): Promise<Source> {
  return request<Source>(`/api/v1/sources/${sourceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
}

export function triggerScan(sourceId: number): Promise<{ job_id: string }> {
  return request<{ job_id: string }>(`/api/v1/sources/${sourceId}/scan`, {
    method: 'POST',
  })
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
