import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import styles from './primitives.module.css'

interface FieldShellProps {
  label: ReactNode
  hint?: ReactNode
  htmlFor: string
  children: ReactNode
}

function FieldShell({ label, hint, htmlFor, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: ReactNode
}

export function TextField({ label, hint, id, ...rest }: TextFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <FieldShell label={label} hint={hint} htmlFor={fieldId}>
      <input id={fieldId} className={styles.input} {...rest} />
    </FieldShell>
  )
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  hint?: ReactNode
  options: Array<{ value: string; label: string }>
}

export function SelectField({ label, hint, id, options, ...rest }: SelectFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <FieldShell label={label} hint={hint} htmlFor={fieldId}>
      <select id={fieldId} className={styles.select} {...rest}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode
  hint?: ReactNode
}

export function TextAreaField({ label, hint, id, ...rest }: TextAreaFieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <FieldShell label={label} hint={hint} htmlFor={fieldId}>
      <textarea id={fieldId} className={styles.textarea} {...rest} />
    </FieldShell>
  )
}

export const layout = styles
