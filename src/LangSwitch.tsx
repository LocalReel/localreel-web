import { SUPPORTED_LANGS, type Lang, type Translate } from './i18n'

interface LangSwitchProps {
  lang: Lang
  onChange: (lang: Lang) => void
  t: Translate
  /** "dark" reuses the Reels overlay button styling instead of the light pills. */
  variant?: 'light' | 'dark'
}

/**
 * Compact 中文 / EN toggle. It is driven by the page's own useLang() instance,
 * so switching immediately re-renders that page and persists the choice.
 */
export default function LangSwitch({
  lang,
  onChange,
  t,
  variant = 'light',
}: LangSwitchProps) {
  const dark = variant === 'dark'
  return (
    <div
      className={dark ? 'reel-actions' : 'filters'}
      style={dark ? { marginTop: 0 } : undefined}
      role="group"
      aria-label={t('lang.label')}
    >
      {SUPPORTED_LANGS.map(option => {
        const active = option === lang
        return (
          <button
            key={option}
            type="button"
            className={dark ? 'reel-button' : active ? 'filter active' : 'filter'}
            aria-pressed={active}
            style={
              dark && active
                ? { borderColor: '#d7a58e', color: '#d7a58e' }
                : undefined
            }
            onClick={() => onChange(option)}
          >
            {t(option === 'zh' ? 'lang.zh' : 'lang.en')}
          </button>
        )
      })}
    </div>
  )
}
