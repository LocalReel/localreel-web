import { useCallback, useState, type ReactNode } from 'react'

import { describeError } from '../../data/client'
import type { AdminHealth, PluginState } from '../../data/types'
import { useT, type TranslationKey } from '../../i18n'
import type { BadgeTone } from '../../ui/Badge'
import type { ButtonSize, ButtonVariant } from '../../ui/Button'
import { Icon } from '../../ui/Icons'
import buttonStyles from '../../ui/Button.module.css'
import styles from './Admin.module.css'

/**
 * Shared console building blocks.
 *
 * The pages are all "one panel, one task"; what they have in common is the
 * shape of a pending write, the inline error with the server's diagnostics, and
 * the stat/fact presentations. Keeping those here is what lets each page stay
 * readable instead of repeating try/catch and markup nine times.
 */

/** The classes of a `Button`, for an anchor that must look like one. */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
): string {
  return [buttonStyles.base, buttonStyles[variant], buttonStyles[size]].join(' ')
}

export interface ActionRunner {
  /** Identifier of the write in flight, so a row can show its own spinner. */
  pending: string | null
  error: unknown
  /** Resolves to the task's value, or undefined when it threw (see `error`). */
  run: <T>(key: string, task: () => Promise<T>, settle?: () => void) => Promise<T | undefined>
  reset: () => void
}

/**
 * One write at a time, with its error kept for an inline notice.
 *
 * `settle` runs after success only, which is where a page reloads its query —
 * a failed write leaves the table as it was.
 */
export function useAction(): ActionRunner {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const run = useCallback(
    async <T,>(key: string, task: () => Promise<T>, settle?: () => void) => {
      setPending(key)
      setError(null)
      try {
        const result = await task()
        settle?.()
        return result
      } catch (cause) {
        setError(cause)
        return undefined
      } finally {
        setPending(null)
      }
    },
    [],
  )

  const reset = useCallback(() => setError(null), [])

  return { pending, error, run, reset }
}

/**
 * An error, inline, where the action was.
 *
 * `ApiError.detail` is admin-only diagnostics (a refused path, a plugin stderr
 * tail); it goes in a disclosure so it is available without shouting.
 */
export function Notice({
  error,
  onDismiss,
}: {
  error: unknown
  onDismiss?: () => void
}) {
  const t = useT()
  const { message, detail } = describeError(error)

  return (
    <div className={styles.notice} role="alert">
      <div className={styles.noticeRow}>
        <Icon name="alert" size={15} />
        <p>{message}</p>
        {onDismiss ? (
          <button
            type="button"
            className={styles.noticeClose}
            onClick={onDismiss}
            aria-label={t('common.dismiss')}
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>
      {detail ? (
        <details className={styles.diagnostics}>
          <summary>{t('common.details')}</summary>
          <pre>{detail}</pre>
        </details>
      ) : null}
    </div>
  )
}

export function StatTile({
  label,
  value,
  note,
  alert,
  tone = 'neutral',
}: {
  label: ReactNode
  value: ReactNode
  note?: ReactNode
  alert?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return (
    <div className={styles.tile} data-tone={tone}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      {note ? <p className={styles.tileNote}>{note}</p> : null}
      {alert ? (
        <p className={styles.tileAlert}>
          <Icon name="alert" size={13} />
          <span>{alert}</span>
        </p>
      ) : null}
    </div>
  )
}

export interface Fact {
  key: string
  label: ReactNode
  value: ReactNode
  mono?: boolean
}

export function FactList({ items }: { items: Fact[] }) {
  return (
    <dl className={styles.facts}>
      {items.map(item => (
        <div key={item.key} className={styles.fact}>
          <dt className={styles.factLabel}>{item.label}</dt>
          <dd className={item.mono ? `${styles.factValue} ${styles.mono}` : styles.factValue}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The three directories the server reports; shared by Overview and About. */
export function PathList({ health }: { health: AdminHealth }) {
  const t = useT()
  return (
    <FactList
      items={[
        { key: 'data', label: t('overview.paths.data'), value: health.data_dir, mono: true },
        {
          key: 'thumbnails',
          label: t('overview.paths.thumbnails'),
          value: health.thumbnail_dir,
          mono: true,
        },
        {
          key: 'transcodes',
          label: t('overview.paths.transcodes'),
          value: health.transcode_dir,
          mono: true,
        },
      ]}
    />
  )
}

/** A labelled group of pressed-state buttons (real buttons, `aria-pressed`). */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  hint?: ReactNode
}) {
  return (
    <div className={styles.choiceGroup}>
      <p className={styles.choiceLabel}>{label}</p>
      <div className={styles.choices} role="group" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className={styles.choice}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint ? <p className={styles.choiceHint}>{hint}</p> : null}
    </div>
  )
}

/** Stable, readable rendering of a capability scope. */
export function scopeText(scope: unknown): string {
  if (scope == null) return '—'
  try {
    return JSON.stringify(scope) ?? String(scope)
  } catch {
    return String(scope)
  }
}

/** Lifecycle state of a plugin, as the two plugin screens present it. */
export const PLUGIN_STATE_KEY: Record<PluginState, TranslationKey> = {
  disabled: 'plugins.state.disabled',
  starting: 'plugins.state.starting',
  running: 'plugins.state.running',
  unhealthy: 'plugins.state.unhealthy',
  failed: 'plugins.state.failed',
  stopped: 'plugins.state.stopped',
}

export const PLUGIN_STATE_TONE: Record<PluginState, BadgeTone> = {
  disabled: 'neutral',
  starting: 'warning',
  running: 'success',
  unhealthy: 'warning',
  failed: 'danger',
  stopped: 'outline',
}
