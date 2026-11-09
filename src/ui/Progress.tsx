import styles from './primitives.module.css'

/** A determinate bar; `value` is a 0–1 fraction. */
export function Progress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <span className={styles.progressFill} style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}
