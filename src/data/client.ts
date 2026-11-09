/**
 * HTTP client.
 *
 * One place that knows about the session, the CSRF header, the error envelope
 * and the four server quirks the UI has to absorb:
 *
 *  - `POST /media/:id/playback` answers 404 with a *success-shaped* body when
 *    the file is missing, so its caller needs that body, not an exception;
 *  - `503 busy` is a normal "try again" answer under memory pressure;
 *  - `/events` is a plain `data:` stream with no `event:` names;
 *  - asset paths are returned by the server and must not be re-derived.
 */

import type {
  AdminHealth,
  AuditEntry,
  AuthStatus,
  BackupReport,
  CacheGcResult,
  CacheStats,
  CapabilityReport,
  CapabilityGrant,
  DeleteSourceReport,
  FeedPage,
  Health,
  JobRecord,
  Media,
  MediaDetail,
  MediaFilter,
  MediaPage,
  MediaState,
  MetadataStatus,
  Playback,
  PluginDescriptor,
  SandboxStatus,
  RemapReport,
  Role,
  ScanIssue,
  ScanRun,
  SecretHandle,
  SeriesDetail,
  SeriesList,
  Source,
  Track,
  UpdateStatus,
  User,
} from './types'

export interface MediaPageQuery {
  q?: string
  filter?: MediaFilter
  limit?: number
  offset?: number
  source_id?: number
  include_archived?: boolean
}

/** An HTTP failure that keeps the status and the server's error code. */
export class ApiError extends Error {
  status: number
  code: string
  /** Server diagnostics: only an admin on loopback (or debug logging) sees it. */
  detail?: string

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export function describeError(cause: unknown): { message: string; detail?: string } {
  if (cause instanceof ApiError) return { message: cause.message, detail: cause.detail }
  if (cause instanceof Error) return { message: cause.message }
  return { message: String(cause) }
}

let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface RequestOptions {
  /** Status codes that carry a usable body and must not throw. */
  accept?: number[]
  /** Keep the request alive when the page is being unloaded. */
  keepalive?: boolean
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (csrfToken && MUTATING.has(method)) headers.set('x-localreel-csrf', csrfToken)

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    method,
    headers,
    keepalive: options.keepalive,
  })

  if (response.status === 401) unauthorizedHandler?.()
  if (options.accept?.includes(response.status)) {
    return (await response.json()) as T
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    let code = 'http_error'
    let detail: string | undefined
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; detail?: string }
      }
      if (body.error?.message) message = body.error.message
      if (body.error?.code) code = body.error.code
      if (body.error?.detail) detail = body.error.detail
    } catch {
      // A plain-text rejection from the guard or ServeDir: keep the status.
    }
    throw new ApiError(response.status, code, message, detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const suffix = search.toString()
  return suffix ? `?${suffix}` : ''
}

/** Join an asset directory and a relative path, escaping each segment. */
export function assetUrl(prefix: string, path: string | null | undefined): string | null {
  if (!path) return null
  const escaped = path.split('/').map(encodeURIComponent).join('/')
  return `${prefix}/${escaped}`
}

export function thumbnailUrl(media: Pick<Media, 'thumbnail_path'>): string | null {
  return assetUrl('/thumbnails', media.thumbnail_path)
}

export function thumbnailUrlOf(path: string | null | undefined): string | null {
  return assetUrl('/thumbnails', path)
}

export function streamUrl(id: number): string {
  return `/api/v1/media/${id}/stream`
}

// --- auth -------------------------------------------------------------------

export function fetchAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>('/api/v1/auth/status')
}

async function startSession(url: string, username: string, password: string): Promise<User> {
  const session = await request<{ user: User; csrf: string }>(
    url,
    json({ username, password }),
  )
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

// --- accounts ---------------------------------------------------------------

export function fetchUsers(): Promise<User[]> {
  return request<User[]>('/api/v1/users')
}

export function createUser(username: string, password: string, role: Role): Promise<User> {
  return request<User>('/api/v1/users', json({ username, password, role }))
}

export function updateUser(
  id: number,
  patch: { role?: Role; enabled?: boolean; password?: string },
): Promise<User> {
  return request<User>(`/api/v1/users/${id}`, {
    ...json(patch),
    method: 'PATCH',
  })
}

export function deleteUser(id: number): Promise<void> {
  return request<void>(`/api/v1/users/${id}`, { method: 'DELETE' })
}

// --- media ------------------------------------------------------------------

export function fetchMedia(params: MediaPageQuery = {}): Promise<MediaPage> {
  return request<MediaPage>(
    `/api/v1/media${query({
      q: params.q,
      filter: params.filter && params.filter !== 'all' ? params.filter : undefined,
      limit: params.limit,
      offset: params.offset,
      source_id: params.source_id,
      include_archived: params.include_archived,
    })}`,
  )
}

export function fetchFeed(limit = 100): Promise<FeedPage> {
  return request<FeedPage>(`/api/v1/feed?limit=${limit}`)
}

export function fetchSeries(): Promise<SeriesList> {
  return request<SeriesList>('/api/v1/series')
}

export function fetchSeriesDetail(id: string): Promise<SeriesDetail> {
  return request<SeriesDetail>(`/api/v1/series/${encodeURIComponent(id)}`)
}

export function fetchMediaDetail(id: number): Promise<MediaDetail> {
  return request<MediaDetail>(`/api/v1/media/${id}`)
}

// --- playback ---------------------------------------------------------------

export function preparePlayback(
  id: number,
  options: { format?: 'hls'; audio?: number | null } = {},
): Promise<Playback> {
  return request<Playback>(
    `/api/v1/media/${id}/playback${query({
      format: options.format,
      audio: options.audio ?? undefined,
    })}`,
    { method: 'POST' },
    { accept: [200, 202, 404] },
  )
}

export function fetchTracks(id: number): Promise<Track[]> {
  return request<Track[]>(`/api/v1/media/${id}/tracks`)
}

/** Preview cues as raw WebVTT text, or null when the file has no sprite. */
export async function fetchPreviewVtt(id: number): Promise<string | null> {
  const response = await fetch(`/api/v1/media/${id}/preview.vtt`, {
    credentials: 'same-origin',
  })
  if (!response.ok) return null
  return response.text()
}

export function fetchState(id: number): Promise<MediaState> {
  return request<MediaState>(`/api/v1/media/${id}/state`)
}

export type StatePatch = {
  position?: number
  duration?: number
  liked?: boolean
  favorite?: boolean
}

export function saveState(id: number, patch: StatePatch): Promise<MediaState> {
  return request<MediaState>(`/api/v1/media/${id}/state`, { ...json(patch), method: 'PUT' })
}

/**
 * The same write, but allowed to outlive the page.
 *
 * `keepalive` requests still need the CSRF header; without it the server
 * rejects the write with 403 and the last few seconds of progress are lost on
 * a tab close.
 */
export function saveStateKeepalive(id: number, patch: StatePatch): void {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (csrfToken) headers.set('x-localreel-csrf', csrfToken)
  void fetch(`/api/v1/media/${id}/state`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify(patch),
    keepalive: true,
  }).catch(() => {
    // Best effort by definition.
  })
}

// --- sources ----------------------------------------------------------------

export function fetchSources(includeArchived = false): Promise<Source[]> {
  return request<Source[]>(
    `/api/v1/sources${includeArchived ? '?include_archived=true' : ''}`,
  )
}

export function addSource(uri: string, kind?: string): Promise<Source> {
  return request<Source>('/api/v1/sources', json(kind ? { uri, kind } : { uri }))
}

export function patchSource(
  id: number,
  patch: { enabled?: boolean; archived?: boolean },
): Promise<Source> {
  return request<Source>(`/api/v1/sources/${id}`, { ...json(patch), method: 'PATCH' })
}

export function deleteSource(
  id: number,
  options: { deleteMedia?: boolean; dryRun?: boolean } = {},
): Promise<DeleteSourceReport> {
  return request<DeleteSourceReport>(
    `/api/v1/sources/${id}${query({
      delete_media: options.deleteMedia,
      dry_run: options.dryRun,
    })}`,
    { method: 'DELETE' },
  )
}

export function scanSource(id: number): Promise<{ job_id: string }> {
  return request<{ job_id: string }>(`/api/v1/sources/${id}/scan`, { method: 'POST' })
}

export function remapSource(
  id: number,
  uri: string,
  dryRun = false,
): Promise<RemapReport> {
  return request<RemapReport>(
    `/api/v1/sources/${id}/remap`,
    json({ uri, dry_run: dryRun }),
  )
}

// --- scans and jobs ---------------------------------------------------------

export function fetchScanRuns(limit = 50): Promise<ScanRun[]> {
  return request<ScanRun[]>(`/api/v1/scan-runs?limit=${limit}`)
}

export function fetchScanIssues(limit = 50): Promise<ScanIssue[]> {
  return request<ScanIssue[]>(`/api/v1/scan-issues?limit=${limit}`)
}

export function fetchJobs(limit = 50): Promise<JobRecord[]> {
  return request<JobRecord[]>(`/api/v1/jobs?limit=${limit}`)
}

export function cancelJob(id: string): Promise<void> {
  return request<void>(`/api/v1/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

// --- cache, health, metadata ------------------------------------------------

export function fetchCacheStats(): Promise<CacheStats> {
  return request<CacheStats>('/api/v1/admin/cache')
}

export function runCacheGc(): Promise<CacheGcResult> {
  return request<CacheGcResult>('/api/v1/admin/cache/gc', json({}))
}

export function fetchAdminHealth(): Promise<AdminHealth> {
  return request<AdminHealth>('/api/v1/admin/health')
}

export function fetchHealth(): Promise<Health> {
  return request<Health>('/api/v1/health')
}

export function fetchUpdateStatus(refresh = false): Promise<UpdateStatus> {
  return request<UpdateStatus>(`/api/v1/admin/update${refresh ? '?refresh=true' : ''}`)
}

export function shutdown(): Promise<{ status: string }> {
  return request<{ status: string }>('/api/v1/admin/shutdown', { method: 'POST' })
}

export function fetchMetadataStatus(): Promise<MetadataStatus> {
  return request<MetadataStatus>('/api/v1/metadata')
}

export function matchMetadata(sourceId?: number): Promise<{ queued: number; fresh: number }> {
  return request<{ queued: number; fresh: number }>(
    '/api/v1/metadata/match',
    json(sourceId ? { source_id: sourceId } : {}),
  )
}

// --- backup -----------------------------------------------------------------

export function backupUrl(): string {
  return '/api/v1/backup'
}

export function importBackup(text: string, dryRun: boolean): Promise<BackupReport> {
  return request<BackupReport>(
    `/api/v1/backup${query({ dry_run: dryRun })}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    },
  )
}

export async function restoreBackupUpload(file: File): Promise<{ job_id: string }> {
  const response = await fetch('/api/v1/backup/restore/upload', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfToken ? { 'x-localreel-csrf': csrfToken } : {},
    body: file,
  })
  if (response.status === 401) unauthorizedHandler?.()
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    let code = 'http_error'
    let detail: string | undefined
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; detail?: string }
      }
      if (body.error?.message) message = body.error.message
      if (body.error?.code) code = body.error.code
      if (body.error?.detail) detail = body.error.detail
    } catch {
      // keep
    }
    throw new ApiError(response.status, code, message, detail)
  }
  return (await response.json()) as { job_id: string }
}

// --- plugins ----------------------------------------------------------------

export async function fetchPlugins(): Promise<PluginDescriptor[]> {
  const body = await request<{ plugins: PluginDescriptor[] }>('/api/v1/plugins')
  return body.plugins
}

export function fetchSandboxStatus(): Promise<SandboxStatus> {
  return request<SandboxStatus>('/api/v1/plugins/sandbox-status')
}

export function fetchCapabilities(id: string): Promise<CapabilityReport> {
  return request<CapabilityReport>(`/api/v1/plugins/${encodeURIComponent(id)}/capabilities`)
}

export function grantCapability(
  id: string,
  capability: string,
  scope?: unknown,
  expiresAt?: number,
): Promise<CapabilityGrant> {
  return request<CapabilityGrant>(
    `/api/v1/plugins/${encodeURIComponent(id)}/capabilities`,
    json({ capability, scope, expires_at: expiresAt }),
  )
}

export function revokeCapability(id: string, capability: string): Promise<void> {
  return request<void>(
    `/api/v1/plugins/${encodeURIComponent(id)}/capabilities/${encodeURIComponent(capability)}`,
    { method: 'DELETE' },
  )
}

export async function fetchSecrets(id: string): Promise<SecretHandle[]> {
  const body = await request<{ handles: SecretHandle[] }>(
    `/api/v1/plugins/${encodeURIComponent(id)}/secrets`,
  )
  return body.handles
}

export function setSecret(id: string, handle: string, value: string): Promise<void> {
  return request<void>(
    `/api/v1/plugins/${encodeURIComponent(id)}/secrets/${encodeURIComponent(handle)}`,
    { ...json({ value }), method: 'PUT' },
  )
}

export function deleteSecret(id: string, handle: string): Promise<void> {
  return request<void>(
    `/api/v1/plugins/${encodeURIComponent(id)}/secrets/${encodeURIComponent(handle)}`,
    { method: 'DELETE' },
  )
}

export function restartPlugin(id: string): Promise<void> {
  return request<void>(`/api/v1/plugins/${encodeURIComponent(id)}/restart`, {
    method: 'POST',
  })
}

export function setPluginEnabled(
  id: string,
  enabled: boolean,
  persist = false,
): Promise<void> {
  return request<void>(
    `/api/v1/plugins/${encodeURIComponent(id)}/${enabled ? 'enable' : 'disable'}${query({ persist })}`,
    { method: 'POST' },
  )
}

export async function fetchPluginLogs(id: string): Promise<string> {
  const body = await request<{ id: string; log: string }>(
    `/api/v1/plugins/${encodeURIComponent(id)}/logs`,
  )
  return body.log
}

export async function fetchAudit(plugin?: string, limit = 50): Promise<AuditEntry[]> {
  const body = await request<{ entries: AuditEntry[] }>(
    `/api/v1/plugins/audit${query({ plugin, limit })}`,
  )
  return body.entries
}
