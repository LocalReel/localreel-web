import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Icon, type IconName } from './Icons'
import styles from './primitives.module.css'

export interface MenuProps {
  label: string
  icon?: IconName
  children: ReactNode
  /** Align the panel to the left edge instead of the right. */
  align?: 'left' | 'right'
  className?: string
  /** Replace the default icon button content with a custom trigger. */
  trigger?: ReactNode
}

/**
 * A disclosure menu: a button that opens a panel of items.
 *
 * Closes on outside press and on Escape, and puts focus on the first item so
 * the keyboard order matches the visual order.
 */
export function Menu({ label, icon = 'more', children, align = 'right', className, trigger }: MenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        wrapRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={className}
        onClick={() => setOpen(value => !value)}
      >
        {trigger ?? <Icon name={icon} size={17} />}
      </button>
      {open ? (
        <div
          ref={panelRef}
          className={align === 'left' ? `${styles.menu} ${styles.menuLeft}` : styles.menu}
          role="menu"
          onClick={event => {
            // A menu item that navigates should close the menu.
            if ((event.target as HTMLElement).closest('button, a')) setOpen(false)
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  checked,
  disabled,
  icon,
}: {
  children: ReactNode
  onClick?: () => void
  checked?: boolean
  disabled?: boolean
  icon?: IconName
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={styles.menuItem}
      onClick={onClick}
      disabled={disabled}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      <span>{children}</span>
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className={styles.menuLabel}>{children}</p>
}

export function MenuHint({ children }: { children: ReactNode }) {
  return <p className={styles.menuHint}>{children}</p>
}
