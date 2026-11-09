/** Language resolution, kept dependency-free so it can be unit tested. */

export type Lang = 'zh' | 'en'

/**
 * Precedence: the stored choice, then the browser, then English.
 * Anything starting with `zh` is treated as Chinese.
 */
export function detectLang(stored: string | null, navigatorLanguage: string | null): Lang {
  if (stored === 'zh' || stored === 'en') return stored
  return navigatorLanguage?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}
