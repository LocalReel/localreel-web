import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { detectLang, type Lang } from '../i18n/detect'

/**
 * Appearance and language settings.
 *
 * The design ships one default preset (dark, tungsten, comfortable) and lets a
 * household change it: theme, accent, density and motion all live on the
 * document element as data attributes, so every token in `tokens.css` follows
 * without a rebuild and without inline styles (the server's CSP allows neither
 * `<style>` blocks nor style attributes).
 */

export type { Lang }
export type Theme = 'dark' | 'light'
export type Accent = 'tungsten' | 'mint' | 'rose' | 'steel'
export type Density = 'comfortable' | 'compact'
export type Motion = 'full' | 'reduced'

export interface UiSettings {
  lang: Lang
  theme: Theme
  accent: Accent
  density: Density
  motion: Motion
}

export const DEFAULT_SETTINGS: UiSettings = {
  lang: 'en',
  theme: 'dark',
  accent: 'tungsten',
  density: 'comfortable',
  motion: 'full',
}

const STORAGE_KEY = 'localreel.ui'
/** Language has its own key from before the settings object existed. */
const LANG_KEY = 'localreel.lang'

function detectInitialLang(): Lang {
  let saved: string | null
  try {
    saved = localStorage.getItem(LANG_KEY)
  } catch {
    saved = null
  }
  return detectLang(saved, typeof navigator !== 'undefined' ? navigator.language : null)
}

export function loadSettings(): UiSettings {
  let stored: Partial<UiSettings> = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) stored = JSON.parse(raw) as Partial<UiSettings>
  } catch {
    stored = {}
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    lang: stored.lang === 'zh' || stored.lang === 'en' ? stored.lang : detectInitialLang(),
  }
}

export function saveSettings(settings: UiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    localStorage.setItem(LANG_KEY, settings.lang)
  } catch {
    // Persisting is a nicety; the session keeps working without it.
  }
}

/** Push the settings onto the document so CSS can react to them. */
export function applySettings(settings: UiSettings): void {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.dataset.accent = settings.accent
  root.dataset.density = settings.density
  root.dataset.motion = settings.motion
  root.lang = settings.lang === 'zh' ? 'zh-CN' : 'en'
}

export const SETTINGS_AREAS = ['lang', 'theme', 'accent', 'density', 'motion'] as const

interface SettingsContextValue {
  settings: UiSettings
  update: (patch: Partial<UiSettings>) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UiSettings>(() => {
    const initial = loadSettings()
    // Applied during the first render so the first paint already has the theme
    // and the right `lang` attribute.
    if (typeof document !== 'undefined') applySettings(initial)
    return initial
  })

  useEffect(() => {
    applySettings(settings)
    saveSettings(settings)
  }, [settings])

  const update = useCallback((patch: Partial<UiSettings>) => {
    setSettings(current => ({ ...current, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setSettings(current => ({ ...DEFAULT_SETTINGS, lang: current.lang }))
  }, [])

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
