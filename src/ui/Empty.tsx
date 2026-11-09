import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/** Empty state: a title, one sentence, and at most one action. */
export function Empty({
  title,
  body,
  action,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {body ? <p className={styles.emptyBody}>{body}</p> : null}
      {action}
    </div>
  )
}
