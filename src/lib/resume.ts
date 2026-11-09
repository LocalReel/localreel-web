export const RESUME_THRESHOLD_SECONDS = 5

/**
 * Seek target for a saved position, or null when resuming would be pointless
 * (within five seconds of either edge, or an unknown duration).
 *
 * Shared by the player page and the reels feed so the threshold cannot drift.
 */
export function resumeTarget(position: number, duration: number): number | null {
  if (!Number.isFinite(position) || !Number.isFinite(duration)) return null
  if (position <= RESUME_THRESHOLD_SECONDS) return null
  if (duration <= 0) return null
  if (position >= duration - RESUME_THRESHOLD_SECONDS) return null
  return Math.min(position, Math.max(0, duration - RESUME_THRESHOLD_SECONDS))
}

/** Whether a saved position counts as "finished" for progress counters. */
export function isFinished(position: number, duration: number): boolean {
  if (!Number.isFinite(position) || position <= 0) return false
  if (!Number.isFinite(duration) || duration <= 0) return false
  return position / duration >= 0.95
}
