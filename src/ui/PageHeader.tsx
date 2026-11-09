import type { ReactNode } from 'react'

import styles from './primitives.module.css'

export function PageHeader({
  kicker,
  title,
  note,
  actions,
}: {
  kicker?: ReactNode
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className={styles.pageHead}>
      <div>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {note ? <p className={styles.pageNote}>{note}</p> : null}
      </div>
      {actions ? <div className={styles.panelTools}>{actions}</div> : null}
    </header>
  )
}

/** A rail heading: title on the left, one link on the right. */
export function SectionTitle({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.sectionTitle}>
      <h2>{title}</h2>
      {action}
    </div>
  )
}
