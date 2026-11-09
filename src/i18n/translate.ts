/** Text lookup, kept free of React so the parity test can import it. */

import { en, type TranslationKey } from './dict.en.ts'
import { zh } from './dict.zh.ts'
import type { Lang } from './detect.ts'

export type { TranslationKey }

export const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, zh }

/** Replace `{name}` placeholders; unknown names are left visible on purpose. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const dictionary = dictionaries[lang] ?? en
  const template = dictionary[key] ?? en[key] ?? String(key)
  return interpolate(template, vars)
}

/** Placeholder names mentioned in a template, for the parity test. */
export function placeholdersOf(template: string): string[] {
  const names = new Set<string>()
  for (const match of template.matchAll(/\{(\w+)\}/g)) names.add(match[1])
  return [...names].sort()
}
