import type { ReactNode } from 'react'

import styles from './primitives.module.css'

export function Spinner({ large = false }: { large?: boolean }) {
  return (
    <span
      className={large ? `${styles.spinner} ${styles.spinnerLarge}` : styles.spinner}
      role="status"
      aria-label="Loading"
    />
  )
}

/** A spinner plus a line of text, for section-level loading. */
export function LoadingRow({ children }: { children: ReactNode }) {
  return (
    <div className={styles.loadingRow} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
