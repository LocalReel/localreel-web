/** Human formatting. One implementation per concept, shared by every surface. */

/** `m:ss`, or `h:mm:ss` from one hour up. Invalid input renders `--:--`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const restLabel = String(rest).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${restLabel}`
  return `${minutes}:${restLabel}`
}

/** Compact span for uptime and job ages: `3d 4h`, `2h 05m`, `12m`. */
export function formatSpan(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.floor(seconds)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}

/** Binary-ish byte sizes, one decimal place above 10× the unit. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unit]}`
}

export function formatNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en').format(value)
}

export function formatDateTime(epochSeconds: number | null | undefined, lang: string): string {
  if (!epochSeconds) return '—'
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(epochSeconds * 1000))
}

export function formatDate(epochSeconds: number | null | undefined, lang: string): string {
  if (!epochSeconds) return '—'
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', {
    dateStyle: 'medium',
  }).format(new Date(epochSeconds * 1000))
}

/** `3 minutes ago` / `3 分钟前`, falling back to a date beyond a month. */
export function formatRelative(epochSeconds: number | null | undefined, lang: string): string {
  if (!epochSeconds) return '—'
  const deltaSeconds = Math.round(epochSeconds - Date.now() / 1000)
  const absolute = Math.abs(deltaSeconds)
  const locale = lang === 'zh' ? 'zh-CN' : 'en'
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (absolute < 60) return formatter.format(Math.round(deltaSeconds), 'second')
  if (absolute < 3600) return formatter.format(Math.round(deltaSeconds / 60), 'minute')
  if (absolute < 86400) return formatter.format(Math.round(deltaSeconds / 3600), 'hour')
  if (absolute < 86400 * 30) return formatter.format(Math.round(deltaSeconds / 86400), 'day')
  return formatDate(epochSeconds, lang)
}

/** Percentage of a file watched, 0–100, rounded. */
export function watchedPercent(position: number, duration: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((position / duration) * 100)))
}
