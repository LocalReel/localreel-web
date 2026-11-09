import type { ReactNode } from 'react'

import styles from './primitives.module.css'

/**
 * A bordered section with a title and optional toolbar.
 *
 * Used for every admin block: one visual container, one heading level, so the
 * console reads as a set of tasks instead of a long scroll of everything.
 */
export function Panel({
  title,
  note,
  tools,
  children,
  flush = false,
  id,
}: {
  title: ReactNode
  note?: ReactNode
  tools?: ReactNode
  children: ReactNode
  flush?: boolean
  id?: string
}) {
  return (
    <section className={styles.panel} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      <header className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {note ? <p className={styles.panelNote}>{note}</p> : null}
        </div>
        {tools ? <div className={styles.panelTools}>{tools}</div> : null}
      </header>
      <div className={flush ? `${styles.panelBody} ${styles.panelBodyFlush}` : styles.panelBody}>
        {children}
      </div>
    </section>
  )
}
