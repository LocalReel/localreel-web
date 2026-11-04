import { type Lang, type Translate } from './i18n'

interface LangSwitchProps {
  lang: Lang
  onChange: (lang: Lang) => void
  t: Translate
  /** "dark" is the translucent variant used over the reels video. */
  variant?: 'light' | 'dark'
}

/**
 * One small globe button instead of a pair of pills.
 *
 * Language is a setting, not an action the user needs every session: the UI
 * already follows the browser language and remembers the choice, so this stays
 * out of the way and only shows the current language code next to the icon.
 */
export default function LangSwitch({
  lang,
  onChange,
  t,
  variant = 'light',
}: LangSwitchProps) {
  const next: Lang = lang === 'zh' ? 'en' : 'zh'
  const label = t('lang.label')
  return (
    <button
      type="button"
      className={`lang-toggle lang-toggle-${variant}`}
      aria-label={label}
      title={label}
      onClick={() => onChange(next)}
    >
      <svg
        className="lang-toggle-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <ellipse cx="12" cy="12" rx="3.6" ry="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.8 12h16.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span className="lang-toggle-code">{lang === 'zh' ? '中' : 'EN'}</span>
    </button>
  )
}
