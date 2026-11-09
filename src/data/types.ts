/**
 * Shapes the server returns, as the UI consumes them.
 *
 * Kept in one file so the API surface is reviewable in a single read. Fields
 * the UI does not use are still declared where they exist on the server, so a
 * missing key shows up as a type error rather than as `undefined` at runtime.
 */

// --- accounts ---------------------------------------------------------------

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
  /** Present only when the request already carries a session. */
  csrf?: string
}

// --- media ------------------------------------------------------------------

export interface Media {
  id: number
  uid: string
  source_id: number
  uri: string
  canonical_path: string
  filename: string
  title: string | null
  duration: number | null
  width: number | null
  height: number | null
  file_size: number
  modified_at: number
  video_codec: string | null
  audio_codec: string | null
  bitrate: number | null
  thumbnail_path: string | null
  missing_at: number | null
  created_at: number
  updated_at: number
  /** From the series derivation; absent on servers older than 0.6. */
  series_key?: string | null
  series_title?: string | null
  episode?: number | null
  series_id?: string | null
}

export interface MediaPage {
  items: Media[]
  total: number
  /** The next `offset`, not an opaque cursor. */
  next_cursor: number | null
}

export type MediaFilter = 'all' | 'favorites' | 'continue'

export interface MediaState {
  user_id: number
  media_id: number
  liked: boolean
  favorite: boolean
  position: number
  duration: number
  updated_at: number
}

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

export interface MediaDetail extends Media {
  metadata?: Metadata
  poster_url?: string
}

/** One show: the episodes that share a `series_key`. */
export interface SeriesSummary {
  id: string
  key: string
  title: string
  episode_count: number
  watched_count: number
  last_media_id: number
  last_position: number
  last_duration: number
  poster_media_id: number
  thumbnail_path: string | null
  updated_at: number
}

export interface SeriesList {
  items: SeriesSummary[]
  total: number
}

export interface SeriesDetail {
  series: SeriesSummary
  episodes: Media[]
}

// --- playback ---------------------------------------------------------------

export type PlaybackMode = 'direct' | 'ready' | 'preparing' | 'failed'

export interface Playback {
  mode: PlaybackMode
  url?: string
  job_id?: string
  message?: string
  /** Client-side only: diagnostics attached when the prepare call failed. */
  detail?: string
}

export interface Track {
  id: number
  media_id: number
  kind: string
  source: 'embedded' | 'sidecar'
  stream_index: number | null
  path: string | null
  format: string | null
  language: string | null
  title: string | null
  channels: number | null
  is_default: boolean
  is_forced: boolean
}

// --- feed -------------------------------------------------------------------

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

// --- sources, scans, jobs ---------------------------------------------------

export interface Source {
  id: number
  uri: string
  kind: string
  enabled: boolean
  created_at: number
  updated_at: number
  archived_at: number | null
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

export interface ScanIssue {
  id: number
  run_id: number
  source_id: number
  uri: string
  kind: string
  message: string
  created_at: number
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface JobRecord {
  id: string
  kind: string
  status: JobStatus
  progress: number
  message: string | null
  result: string | null
  error: string | null
  attempts: number
  max_attempts: number
  created_at: number
  started_at: number | null
  finished_at: number | null
  cancel_requested: boolean
}

export interface CacheStats {
  transcode_count: number
  transcode_bytes: number
  thumbnail_count: number
  thumbnail_bytes: number
  total_bytes: number
}

export interface CacheGcResult {
  removed: number
  freed_bytes: number
  kept: number
  remaining_bytes: number
}

// --- admin health -----------------------------------------------------------

export interface WatcherStatus {
  enabled: boolean
  active: number
  skipped: string[]
}

export interface TranscodeStatus {
  running: number
  queued: number
  limit: number
  sessions: number
}

export interface AdminHealth {
  name: string
  status: string
  version: string
  mode: string
  database: boolean
  ffmpeg: boolean
  ffmpeg_capability: 'full' | 'probe-only' | 'missing'
  hwaccel: string | null
  media_count: number
  data_dir: string
  thumbnail_dir: string
  transcode_dir: string
  watchers: WatcherStatus
  transcodes: TranscodeStatus
  jobs: JobRecord[]
}

export interface Health {
  name: string
  status: string
  version: string
  mode: string
  database: boolean
  ffmpeg: boolean
  ffmpeg_capability: 'full' | 'probe-only' | 'missing'
  media_count: number
  uptime_seconds: number
}

export interface UpdateStatus {
  enabled: boolean
  current: string
  latest: {
    version: string
    url: string
    published_at: string | null
    setup_url: string | null
  } | null
  update_available: boolean
  checked_at: number
  error: string | null
}

export interface MetadataStatus {
  configured: string
  provider: string | null
  language: string
}

// --- plugins ----------------------------------------------------------------

export type PluginState =
  | 'disabled'
  | 'starting'
  | 'running'
  | 'unhealthy'
  | 'failed'
  | 'stopped'

export interface PluginDescriptor {
  id: string
  name: string
  version: string
  permissions: string[]
  network: boolean
  running: boolean
  state: PluginState
  enabled: boolean
  error?: string
  restarts: number
  generation: number
  started_at?: number
  package: string
  transport: string
  sandbox: string
}

export interface SandboxStatus {
  platform: string
  app_container: boolean
  wrapper_present: boolean
  unshare_present: boolean
}

export interface PackageVerification {
  id: number
  plugin_id: string
  plugin_version: string
  package_sha256: string
  publisher?: string
  public_key_fingerprint?: string
  signature_verified: boolean
  at: number
  chain_hash?: string
}

export interface VerificationChain {
  checked: number
  valid: boolean
  broken_at: number | null
  anchored: boolean
  anchor_valid: boolean | null
}

export interface StagedPackage {
  id: string
  version: string
  path: string
  metadata?: {
    sha256?: string
    publisher?: string
    signature_verified?: boolean
    staged_at?: number
  } | null
}

export interface RequestedCapability {
  name: string
  scope: unknown
  tier: number
  source: string
  title: string
  description: string
  audit: string
}

export interface CapabilityDescriptor {
  name: string
  tier: number
  title: string
  description: string
  audit: string
}

export interface CapabilityGrant {
  id: number
  plugin_id: string
  plugin_version: string
  capability: string
  scope: unknown
  scope_digest: string
  tier: number
  granted_by: number | null
  granted_at: number
  expires_at: number | null
  revoked_at: number | null
}

export interface CapabilityReport {
  plugin_id: string
  name: string
  version: string
  requested: RequestedCapability[]
  granted: CapabilityGrant[]
  catalog: CapabilityDescriptor[]
  forbidden: string[]
  /** Capabilities the host is still waiting on a decision for. */
  pending?: string[]
  /** True when the plugin cannot work until something is granted. */
  requires_grant?: boolean
}

export interface AuditEntry {
  id: number
  plugin_id: string
  permission: string | null
  action: string
  detail: string | null
  at: number
  capability: string | null
  scope_digest: string | null
  result: string | null
  bytes_in: number | null
  bytes_out: number | null
  duration_ms: number | null
  request_id: string | null
  job_id: string | null
  user_id: number | null
}

export interface SecretHandle {
  handle: string
  created_at: number
  updated_at: number
}

export interface BackupReport {
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

export interface RemapReport {
  source_id: number
  source_uri: string
  dry_run: boolean
  media_moved: number
  missing: number
  conflicts: string[]
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
