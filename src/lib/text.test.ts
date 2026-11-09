import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanTitle, episodeOf, extensionOf } from './text.ts'

test('release tags are stripped from a title', () => {
  assert.equal(cleanTitle('[Group] Some Show [01][1080p].mkv'), 'Some Show')
  assert.equal(cleanTitle('中文 名字 带空格.mp4'), '中文 名字 带空格')
  assert.equal(cleanTitle('第12话 赫克斯塔斯之光.mp4'), '第12话 赫克斯塔斯之光')
  assert.equal(cleanTitle('a_b_c.mkv'), 'a b c')
})

test('a name made only of tags cleans down to nothing', () => {
  assert.equal(cleanTitle('[BeanSub][170018][12][END][GB][720P][MP4]'), '')
})

test('the extension is surfaced for placeholders', () => {
  assert.equal(extensionOf('movie.mkv'), 'MKV')
  assert.equal(extensionOf('no-extension'), 'FILE')
  assert.equal(extensionOf('.hidden'), 'FILE')
})

test('episode numbers come from the server field first', () => {
  assert.equal(episodeOf({ episode: 12, filename: 'whatever.mkv' }), 12)
  assert.equal(episodeOf({ episode: null, filename: 'Show - 07 [720p].mkv' }), 7)
  assert.equal(episodeOf({ episode: null, filename: '第09话 标题.mp4' }), 9)
  assert.equal(episodeOf({ episode: null, filename: 'movie.mp4' }), null)
})
