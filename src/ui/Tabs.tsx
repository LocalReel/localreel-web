import { useRef, type ReactNode } from 'react'

import styles from './primitives.module.css'

export interface TabItem {
  id: string
  label: ReactNode
  /** Optional trailing count, rendered dimmer. */
  count?: number
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  label: string
}

/**
 * Segmented control for switching one view.
 *
 * Implements the keyboard contract of a tablist: arrows move and select, Home
 * and End jump to the ends. The tabs are buttons, so Tab reaches the group once
 * and leaves again from the selected tab.
 */
export function Tabs({ items, value, onChange, label }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const move = (delta: number) => {
    const index = items.findIndex(item => item.id === value)
    const next = (index + delta + items.length) % items.length
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={element => {
            refs.current[index] = element
          }}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(item.id)}
          onKeyDown={event => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              move(1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              move(-1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              onChange(items[0].id)
              refs.current[0]?.focus()
            } else if (event.key === 'End') {
              event.preventDefault()
              onChange(items[items.length - 1].id)
              refs.current[items.length - 1]?.focus()
            }
          }}
        >
          {item.label}
          {item.count != null ? <span className={styles.tabCount}>{item.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
