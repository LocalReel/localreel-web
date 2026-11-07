import { parsePreviewVtt, type PreviewSprite } from './preview'

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

/**
 * One item of the ranked scroll feed. The server already decides the order
 * (continue-watching first, then unwatched episodes in series order, then
 * unwatched movies, then finished items), so the client only renders it.
 *
 * `next_id` is the next episode in the same series (null for movies and for the
 * last episode) and drives autoplay.
 */
export interface FeedItem {
  id: number
  title: string | null
  filename: string
  series_key: string | null
  series_title: string | null
  episode: number | null
  width: number | null
  height: number | null
  duration: number
  position: number
  finished: boolean
  favorite: boolean
  liked: boolean
  playback: 'direct' | 'remux' | 'transcode'
  next_id: number | null
  created_at: number
  thumbnail_path: string | null
}

export interface FeedPage {
  items: FeedItem[]
  total: number
}

export interface Playback {
  mode: 'direct' | 'ready' | 'preparing' | 'failed'
  url?: string
  job_id?: string
  message?: string
  /**
   * Client-side diagnostics attached when the prepare call itself failed; the
   * server never sends this field inside a successful playback response.
   */
  detail?: string
}

/** One audio track of a media item. */
export interface Track {
  id: number
  media_id: number
  /** `audio` today; subtitle is reserved. */
  kind: string
  source: 'embedded' | 'sidecar'
  /** ffmpeg stream index; null for sidecar tracks. */
  stream_index: number | null
  path: string | null
  format: string | null
  /** Normalized tag such as `zh`, `ja`, `en`. */
  language: string | null
  title: string | null
  channels: number | null
  is_default: boolean
  is_forced: boolean
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
  archived_at: number | null
}

export interface JobRecord {
  id: string
  kind: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
  progress: number
  attempts: number
  max_attempts: number
  message: string | null
  result: string | null
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

export interface RemapReport {
  source_id: number
  old_uri: string
  new_uri: string
  dry_run: boolean
  media_total: number
  remapped: number
  missing: number
  skipped: number
  warnings: string[]
}

export interface BackupImportReport {
  dry_run: boolean
  sources: number
  sources_added: number
  users: number
  users_created: number
  states: number
  imported: number
  unchanged: number
  missing: number
  warnings: string[]
}

export interface DeleteSourceReport {
  source_id: number
  source_uri: string
  dry_run: boolean
  archived: boolean
  media_count: number
  state_count: number
  variant_count: number
  deleted_files: number
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

export interface WatcherStatus {
  /** Whether watching is configured at all (`[scan] watch` / `LOCALREEL_WATCH`). */
  enabled: boolean
  /** Sources with a live filesystem subscription. */
  active: number
  /** Sources that cannot be watched, as `kind:uri`. */
  skipped: string[]
}

export interface TranscodeStatus {
  /** Jobs currently holding an ffmpeg slot. */
  running: number
  /** Jobs waiting for one. */
  queued: number
  /** Configured maximum. */
  limit: number
  /** Live playback sessions. */
  sessions: number
}

/** What the installed ffmpeg/ffprobe pair can do. */
export type FfmpegCapability = 'full' | 'probe-only' | 'missing'

/** Resolved hardware acceleration; `none` means the CPU encodes. */
export type HwAccel = 'auto' | 'none' | 'nvenc' | 'qsv' | 'vaapi' | 'videotoolbox'

export interface AdminHealth {
  status: string
  version: string
  database: boolean
  /** Whether transcoding is possible (`ffmpeg_capability === 'full'`). */
  ffmpeg: boolean
  ffmpeg_capability: FfmpegCapability
  /** The accelerator actually in use (`none` when falling back to the CPU). */
  hwaccel: HwAccel
  media_count: number
  data_dir: string
  thumbnail_dir: string
  transcode_dir: string
  watchers: WatcherStatus
  transcodes: TranscodeStatus
  jobs: JobRecord[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; detail?: string }
}

/** An HTTP error that keeps the status code, so the UI can react to 401/403. */
export class ApiError extends Error {
  status: number
  code: string
  /**
   * Server-side diagnostics (a local path, an ffmpeg stderr tail).
   *
   * Only an administrator on loopback — or one running with `RUST_LOG=debug` —
   * receives this, so it is frequently absent.
   */
  detail?: string

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

/** Split any thrown value into text to show and optional diagnostics. */
export function describeError(cause: unknown): { message: string; detail?: string } {
  if (cause instanceof ApiError) return { message: cause.message, detail: cause.detail }
  if (cause instanceof Error) return { message: cause.message }
  return { message: String(cause) }
}

/**
 * CSRF token for the current session.
 *
 * The server sets it in a readable cookie after sign-in and requires it back in
 * an `x-localreel-csrf` header on every state-changing request, so a page from
 * another origin cannot drive the API with the session cookie.
 */
let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export function currentCsrfToken(): string | null {
  return csrfToken
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Called when any request comes back 401, so the UI can return to sign-in. */
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (csrfToken && MUTATING_METHODS.has(method)) {
    headers.set('x-localreel-csrf', csrfToken)
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    method,
    headers,
  })

  if (response.status === 401) {
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    let code = 'http_error'
    let detail: string | undefined
    try {
      const body = (await response.json()) as ApiErrorBody
      if (body.error?.message) message = body.error.message
      if (body.error?.code) code = body.error.code
      if (body.error?.detail) detail = body.error.detail
    } catch {
      // keep the status-based message
    }
    throw new ApiError(response.status, code, message, detail)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

// --- Accounts ---------------------------------------------------------------

export type Role = 'admin' | 'user'

export interface User {
  id: number
  username: string
  role: Role
  enabled: boolean
  created_at: number
  updated_at: number
  last_login_at: number | null
}

export interface AuthStatus {
  setup_required: boolean
  authenticated: boolean
  user: User | null
  mode: string
  /**
   * The CSRF token for the session this request already carries.
   *
   * Present only when authenticated. A reload keeps the cookie but loses the
   * token in memory, so the status call restores it.
   */
  csrf?: string
}

interface SessionResponse {
  user: User
  csrf: string
}

export function fetchAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>('/api/v1/auth/status')
}

async function startSession(
  url: string,
  username: string,
  password: string,
): Promise<User> {
  const session = await request<SessionResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  setCsrfToken(session.csrf)
  return session.user
}

export function login(username: string, password: string): Promise<User> {
  return startSession('/api/v1/auth/login', username, password)
}

export function setupOwner(username: string, password: string): Promise<User> {
  return startSession('/api/v1/auth/setup', username, password)
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/api/v1/auth/logout', { method: 'POST' })
  } finally {
    setCsrfToken(null)
  }
}

export function fetchMe(): Promise<User> {
  return request<User>('/api/v1/auth/me')
}

export function fetchUsers(): Promise<User[]> {
  return request<User[]>('/api/v1/users')
}

export function createUser(
  username: string,
  password: string,
  role: Role,
): Promise<User> {
  return request<User>('/api/v1/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  })
}

export function updateUser(
  id: number,
  patch: { role?: Role; enabled?: boolean; password?: string },
): Promise<User> {
  return request<User>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export function deleteUser(id: number): Promise<void> {
  return request<void>(`/api/v1/users/${id}`, { method: 'DELETE' })
}

export function addSource(uri: string, kind?: string): Promise<Source> {
  return request<Source>('/api/v1/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kind ? { uri, kind } : { uri }),
  })
}

export function fetchMedia(params: {
  q?: string
  filter?: MediaFilter
  limit?: number
  offset?: number
  source_id?: number
  includeArchived?: boolean
}): Promise<MediaPage> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.filter && params.filter !== 'all') search.set('filter', params.filter)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  if (params.source_id) search.set('source_id', String(params.source_id))
  if (params.includeArchived) search.set('include_archived', 'true')
  const suffix = search.toString()
  return request<MediaPage>(`/api/v1/media${suffix ? `?${suffix}` : ''}`)
}

/**
 * Fetch the ranked feed for the vertical scroll view. The server clamps the
 * limit to 1..200; the default matches the first screenful we preload around.
 */
export function fetchFeed(limit = 100): Promise<FeedPage> {
  return request<FeedPage>(`/api/v1/feed?limit=${limit}`)
}

/**
 * Ask the server how to play a media item.
 *
 * `audio` names a track id; choosing anything but the default track makes the
 * server re-mux or transcode, because a browser cannot switch embedded audio.
 */
export function preparePlayback(
  id: number,
  options: { format?: 'hls'; audio?: number | null } = {},
): Promise<Playback> {
  const search = new URLSearchParams()
  if (options.format) search.set('format', options.format)
  if (options.audio) search.set('audio', String(options.audio))
  const suffix = search.toString()
  return request<Playback>(
    `/api/v1/media/${id}/playback${suffix ? `?${suffix}` : ''}`,
    { method: 'POST' },
  )
}

export function fetchTracks(id: number): Promise<Track[]> {
  return request<Track[]>(`/api/v1/media/${id}/tracks`)
}

/**
 * Progress-bar preview cues, or `null` when the file has none.
 *
 * Short videos are never given a sprite, so a 404 here is normal.
 */
export async function fetchPreview(id: number): Promise<PreviewSprite | null> {
  const response = await fetch(`/api/v1/media/${id}/preview.vtt`, {
    credentials: 'same-origin',
  })
  if (!response.ok) return null
  return parsePreviewVtt(await response.text())
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

/** External metadata from an optional provider (TMDB). */
export interface Metadata {
  media_id: number
  provider: string
  provider_id: string
  title: string | null
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  vote_average: number | null
  confidence: number
  fetched_at: number
}

/** `GET /media/:id`: the row plus whatever matched it. */
export interface MediaDetail extends Media {
  metadata?: Metadata
  poster_url?: string
}

export interface MetadataStatus {
  /** What the configuration asks for (`none` or `tmdb`). */
  configured: string
  /** The provider actually active (null when disabled or keyless). */
  provider: string | null
  language: string
}

export function fetchMediaDetail(id: number): Promise<MediaDetail> {
  return request<MediaDetail>(`/api/v1/media/${id}`)
}

export function fetchMetadataStatus(): Promise<MetadataStatus> {
  return request<MetadataStatus>('/api/v1/metadata')
}

export function matchMetadata(sourceId?: number): Promise<{
  queued: number
  fresh: number
}> {
  return request<{ queued: number; fresh: number }>('/api/v1/metadata/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId ?? null }),
  })
}

export interface PluginSummary {
  id: string
  name: string
  version: string
  /** Effective permissions, including the storage baseline. */
  permissions: string[]
  /** Whether the host will proxy network requests for it. */
  network: boolean
  running: boolean
}

export interface PluginAuditEntry {
  id: number
  plugin_id: string
  permission: string | null
  action: string
  detail: string | null
  at: number
}

export function fetchPlugins(): Promise<{ plugins: PluginSummary[] }> {
  return request<{ plugins: PluginSummary[] }>('/api/v1/plugins')
}

export function fetchPluginAudit(
  limit = 20,
): Promise<{ entries: PluginAuditEntry[] }> {
  return request<{ entries: PluginAuditEntry[] }>(
    `/api/v1/plugins/audit?limit=${limit}`,
  )
}

export function fetchAdminHealth(): Promise<AdminHealth> {
  return request<AdminHealth>('/api/v1/admin/health')
}

export function fetchSources(includeArchived = false): Promise<Source[]> {
  const suffix = includeArchived ? '?include_archived=true' : ''
  return request<Source[]>(`/api/v1/sources${suffix}`)
}

export function fetchJobs(limit = 20): Promise<JobRecord[]> {
  return request<JobRecord[]>(`/api/v1/jobs?limit=${limit}`)
}

export function fetchScanRuns(limit = 20): Promise<ScanRun[]> {
  return request<ScanRun[]>(`/api/v1/scan-runs?limit=${limit}`)
}

export async function importBackup(
  file: File,
  dryRun: boolean,
): Promise<BackupImportReport> {
  const text = await file.text()
  return request<BackupImportReport>(`/api/v1/backup?dry_run=${dryRun}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  })
}

export async function restoreBackup(file: File): Promise<{ job_id: string }> {
  return request<{ job_id: string }>('/api/v1/backup/restore/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: file,
  })
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

/** Ask the process to stop; the response is sent before it does. */
export function shutdownServer(): Promise<{ status: string }> {
  return request<{ status: string }>('/api/v1/admin/shutdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export function deleteSource(
  sourceId: number,
  options: { deleteMedia?: boolean; dryRun?: boolean } = {},
): Promise<DeleteSourceReport> {
  const params = new URLSearchParams()
  if (options.deleteMedia) params.set('delete_media', 'true')
  if (options.dryRun) params.set('dry_run', 'true')
  const suffix = params.toString()
  return request<DeleteSourceReport>(
    `/api/v1/sources/${sourceId}${suffix ? `?${suffix}` : ''}`,
    { method: 'DELETE' },
  )
}

export function setSourceEnabled(sourceId: number, enabled: boolean): Promise<Source> {
  return request<Source>(`/api/v1/sources/${sourceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
}

export function remapSource(
  sourceId: number,
  uri: string,
  dryRun: boolean,
): Promise<RemapReport> {
  return request<RemapReport>(`/api/v1/sources/${sourceId}/remap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri, dry_run: dryRun }),
  })
}

export function setSourceArchived(sourceId: number, archived: boolean): Promise<Source> {
  return request<Source>(`/api/v1/sources/${sourceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived }),
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
