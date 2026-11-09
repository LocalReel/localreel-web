import type { ReactNode } from 'react'

import styles from './primitives.module.css'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'outline'

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: BadgeTone
  title?: string
}) {
  return (
    <span className={styles.badge} data-tone={tone} title={title}>
      {children}
    </span>
  )
}
