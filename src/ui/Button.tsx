import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Icon, type IconName } from './Icons'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconAfter?: IconName
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  loading = false,
  block = false,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.base,
    styles[variant],
    styles[size],
    children == null ? (size === 'sm' ? styles.iconSm : styles.icon) : '',
    block ? styles.block : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {!loading && icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === 'sm' ? 15 : 17} /> : null}
    </button>
  )
}
