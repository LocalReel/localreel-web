import { useCallback } from 'react'

import { useSettings } from '../app/settings'
import type { TranslationKey } from './translate'
import { translate } from './translate'
import type { Lang } from './detect'

export type { TranslationKey, Lang }
export { detectLang } from './detect'
export { dictionaries, interpolate, placeholdersOf, translate } from './translate'

export function useT() {
  const { settings } = useSettings()
  const lang = settings.lang
  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  )
}

export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
  const { settings, update } = useSettings()
  return {
    lang: settings.lang,
    setLang: useCallback((lang: Lang) => update({ lang }), [update]),
  }
}
