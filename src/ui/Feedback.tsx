import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { Button } from './Button'
import { Dialog } from './Dialog'
import { Icon } from './Icons'
import { useT } from '../i18n'
import styles from './primitives.module.css'

// --- toasts ----------------------------------------------------------------

export type ToastTone = 'info' | 'success' | 'danger'

interface ToastEntry {
  id: number
  message: ReactNode
  tone: ToastTone
}

interface ToastValue {
  push: (message: ReactNode, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([])
  const nextId = useRef(1)

  const push = useCallback((message: ReactNode, tone: ToastTone = 'info') => {
    const id = nextId.current++
    setEntries(current => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setEntries(current => current.filter(entry => entry.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toastLayer} role="status" aria-live="polite">
        {entries.map(entry => (
          <div key={entry.id} className={styles.toast} data-tone={entry.tone}>
            <Icon
              name={entry.tone === 'danger' ? 'alert' : entry.tone === 'success' ? 'check' : 'info'}
              size={16}
            />
            <span>{entry.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}

// --- confirmations ---------------------------------------------------------

export interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}

type ConfirmRequest = ConfirmOptions & { resolve: (value: boolean) => void }

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

/**
 * Promise-based confirmation.
 *
 * Replaces `window.confirm`, which cannot be styled, cannot be translated
 * completely and blocks the page while it is open.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        setRequest({ ...options, resolve })
      }),
    [],
  )

  const settle = (value: boolean) => {
    request?.resolve(value)
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request != null}
        title={request?.title ?? ''}
        description={request?.body}
        onClose={() => settle(false)}
        dismissible
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {request?.cancelLabel}
            </Button>
            <Button
              variant={request?.danger ? 'danger' : 'primary'}
              onClick={() => settle(true)}
              autoFocus
            >
              {request?.confirmLabel}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const value = useContext(ConfirmContext)
  if (!value) throw new Error('useConfirm must be used inside ConfirmProvider')
  return value
}
