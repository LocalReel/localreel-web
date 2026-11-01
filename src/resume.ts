export const RESUME_THRESHOLD_SECONDS = 5

/**
 * Return the seek target for a saved position, or null when the position is
 * too close to the start/end to be useful. Shared by Reels and the modal
 * Player so the threshold/clamp cannot drift between them.
 */
export function resumeTarget(position: number, duration: number): number | null {
  if (!Number.isFinite(position) || !Number.isFinite(duration)) return null
  if (position <= RESUME_THRESHOLD_SECONDS) return null
  if (duration <= 0) return null
  if (position >= duration - RESUME_THRESHOLD_SECONDS) return null
  return Math.min(position, Math.max(0, duration - RESUME_THRESHOLD_SECONDS))
}
