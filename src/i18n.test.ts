import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LANG_STORAGE_KEY,
  SUPPORTED_LANGS,
  detectLang,
  dictionaries,
  isLang,
  langFromNavigator,
  resolveLang,
  t,
  type Lang,
  type TranslationKey,
} from './i18n.ts'

const langs: Lang[] = ['zh', 'en']

function placeholders(value: string): string[] {
  const found = new Set<string>()
  for (const match of value.matchAll(/\{(\w+)\}/g)) found.add(match[1])
  return [...found].sort()
}

test('zh and en dictionaries expose exactly the same keys', () => {
  const enKeys = Object.keys(dictionaries.en).sort()
  const zhKeys = Object.keys(dictionaries.zh).sort()
  assert.deepEqual(zhKeys, enKeys, 'zh dictionary must mirror the en key set')
  assert.ok(enKeys.length > 0, 'dictionaries must not be empty')

  for (const key of enKeys as TranslationKey[]) {
    assert.equal(typeof dictionaries.en[key], 'string', `en ${key} must be a string`)
    assert.equal(typeof dictionaries.zh[key], 'string', `zh ${key} must be a string`)
    assert.ok(dictionaries.en[key].length > 0, `en ${key} must not be empty`)
    assert.ok(dictionaries.zh[key].length > 0, `zh ${key} must not be empty`)
  }
})

test('both languages keep the same placeholders for every key', () => {
  for (const key of Object.keys(dictionaries.en) as TranslationKey[]) {
    assert.deepEqual(
      placeholders(dictionaries.zh[key]),
      placeholders(dictionaries.en[key]),
      `placeholder mismatch for ${key}`,
    )
  }
})

test('interpolates named placeholders per language', () => {
  assert.equal(t('en', 'reels.kicker', { duration: '1:23' }), 'Reel · 1:23')
  assert.equal(t('zh', 'reels.kicker', { duration: '1:23' }), '短视频 · 1:23')
  assert.equal(t('en', 'library.count.one', { count: 1 }), '1 item')
  assert.equal(t('en', 'library.count.other', { count: 7 }), '7 items')
  assert.equal(t('zh', 'library.count.other', { count: 7 }), '7 个条目')
  assert.equal(
    t('en', 'admin.remove.detail', { media: 3, states: 2, variants: 1 }),
    '3 media items, 2 states, 1 artifacts',
  )
  assert.equal(
    t('zh', 'admin.remove.detail', { media: 3, states: 2, variants: 1 }),
    '3 个媒体、2 条状态、1 个产物',
  )
  // Numbers are stringified, and multi-placeholder templates fill every slot.
  assert.equal(t('en', 'admin.cache.lastJob', { status: 'running' }), 'Last GC job: running')
  assert.ok(
    !t('en', 'admin.remove.confirm', { uri: '/media', detail: 'x' }).includes('{'),
  )
})

test('leaves unknown placeholders and unknown keys untouched', () => {
  assert.equal(t('en', 'reels.kicker'), 'Reel · {duration}')
  assert.equal(t('zh', 'library.count.other', { count: 2 }), '2 个条目')
  assert.equal(
    t('en', 'does.not.exist' as TranslationKey, { anything: 1 }),
    'does.not.exist',
  )
})

test('resolves language from a stored value, then navigator, then English', () => {
  assert.equal(resolveLang('zh', 'en-US'), 'zh')
  assert.equal(resolveLang('en', 'zh-CN'), 'en')
  // Invalid stored values fall through to the browser default.
  assert.equal(resolveLang('fr', 'zh-CN'), 'zh')
  assert.equal(resolveLang('', 'en-US'), 'en')
  assert.equal(resolveLang(null, 'zh-CN'), 'zh')
  assert.equal(resolveLang(undefined, 'zh-Hans-CN'), 'zh')
  assert.equal(resolveLang(null, 'en-US'), 'en')
  assert.equal(resolveLang(null, 'fr-FR'), 'en')
  assert.equal(resolveLang(null, null), 'en')
  assert.equal(resolveLang(undefined, undefined), 'en')
})

test('maps browser language tags starting with zh to Chinese', () => {
  assert.equal(langFromNavigator('zh'), 'zh')
  assert.equal(langFromNavigator('zh-CN'), 'zh')
  assert.equal(langFromNavigator('zh-Hans-CN'), 'zh')
  assert.equal(langFromNavigator('ZH-TW'), 'zh')
  assert.equal(langFromNavigator('zh_TW'), 'zh')
  assert.equal(langFromNavigator('en-US'), 'en')
  assert.equal(langFromNavigator('ja-JP'), 'en')
  assert.equal(langFromNavigator(''), 'en')
  assert.equal(langFromNavigator(undefined), 'en')
})

test('detectLang prefers a valid stored language and falls back safely', () => {
  assert.equal(detectLang({ stored: 'en', navigatorLanguage: 'zh-CN' }), 'en')
  assert.equal(detectLang({ stored: 'zh', navigatorLanguage: 'en-US' }), 'zh')
  assert.equal(detectLang({ stored: 'fr', navigatorLanguage: 'zh-CN' }), 'zh')
  assert.equal(detectLang({ stored: 'bogus', navigatorLanguage: 'en-US' }), 'en')
  assert.equal(detectLang({ navigatorLanguage: 'zh-TW' }), 'zh')
  assert.equal(detectLang({}), 'en')

  // Without arguments it reads the runtime environment, and whatever it finds
  // must be a supported language.
  assert.ok(langs.includes(detectLang()))
})

test('exports the documented storage key and language codes', () => {
  assert.equal(LANG_STORAGE_KEY, 'localreel.lang')
  assert.deepEqual([...SUPPORTED_LANGS], ['zh', 'en'])
  assert.equal(isLang('zh'), true)
  assert.equal(isLang('en'), true)
  assert.equal(isLang('fr'), false)
  assert.equal(isLang(null), false)
  assert.equal(isLang(undefined), false)
})
