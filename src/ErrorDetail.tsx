import type { Translate } from './i18n'

/**
 * Collapsible server diagnostics under an error message.
 *
 * The API only includes `detail` for an administrator (from loopback, or with
 * `RUST_LOG=debug`), so an ordinary viewer never sees this section at all.
 */
export default function ErrorDetail({
  detail,
  t,
}: {
  detail: string | null | undefined
  t: Translate
}) {
  if (!detail) return null
  return (
    <details className="error-detail">
      <summary>{t('error.detail')}</summary>
      <pre>{detail}</pre>
    </details>
  )
}
