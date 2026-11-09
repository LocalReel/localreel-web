import assert from 'node:assert/strict'
import test from 'node:test'

import { en } from './dict.en.ts'
import { zh } from './dict.zh.ts'
import { dictionaries, interpolate, placeholdersOf, translate } from './translate.ts'
import { detectLang } from './detect.ts'

test('both dictionaries carry exactly the same keys', () => {
  const english = Object.keys(en).sort()
  const chinese = Object.keys(zh).sort()
  assert.deepEqual(chinese, english)
})

test('no translation is empty', () => {
  for (const [language, dictionary] of Object.entries(dictionaries)) {
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.trim().length > 0, `${language}:${key} is empty`)
    }
  }
})

test('placeholders match per key across languages', () => {
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    assert.deepEqual(
      placeholdersOf(zh[key]),
      placeholdersOf(en[key]),
      `placeholder mismatch for ${String(key)}`,
    )
  }
})

test('interpolation replaces known names and leaves unknown ones visible', () => {
  assert.equal(interpolate('a {b} c', { b: 1 }), 'a 1 c')
  assert.equal(interpolate('a {b} c'), 'a {b} c')
  assert.equal(interpolate('{x} {y}', { x: 'one' }), 'one {y}')
})

test('translate falls back to English for an unknown language tag', () => {
  // @ts-expect-error deliberately passing an unsupported language
  assert.equal(translate('fr', 'nav.home'), en['nav.home'])
})

test('language detection prefers the stored choice, then the browser', () => {
  assert.equal(detectLang('zh', 'en-US'), 'zh')
  assert.equal(detectLang('en', 'zh-CN'), 'en')
  assert.equal(detectLang(null, 'zh-CN'), 'zh')
  assert.equal(detectLang(null, 'zh-Hant-TW'), 'zh')
  assert.equal(detectLang(null, 'en-GB'), 'en')
  assert.equal(detectLang(null, null), 'en')
  assert.equal(detectLang('de', 'zh-CN'), 'zh')
})
