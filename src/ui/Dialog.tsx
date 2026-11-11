import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icons'
import styles from './Dialog.module.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  open: boolean
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  onClose: () => void
  /** Set false for destructive confirmations that must be answered. */
  dismissible?: boolean
  wide?: boolean
  labelledBy?: string
  /** Accessible name for the close button; translated by the caller. */
  closeLabel?: string
}

/**
 * Modal dialog with the behaviours a `role="dialog"` promises: focus moves in,
 * Tab cycles inside, Escape closes, the background stops scrolling and focus
 * returns to whatever opened it.
 */
export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  dismissible = true,
  wide = false,
  closeLabel = 'Close',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const closeRef = useRef({ dismissible, onClose })
  closeRef.current = { dismissible, onClose }
  const close = useCallback(() => {
    if (closeRef.current.dismissible) closeRef.current.onClose()
  }, [])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        element => element.offsetParent !== null || element === document.activeElement,
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [close, open])

  if (!open) return null

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={event => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        className={wide ? `${styles.dialog} ${styles.wide}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className={styles.description}>
                {description}
              </div>
            ) : null}
          </div>
          {dismissible ? (
            <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
              <Icon name="close" size={18} />
            </button>
          ) : null}
        </div>
        {children ? <div className={styles.body}>{children}</div> : null}
        {footer ? <div className={styles.foot}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
