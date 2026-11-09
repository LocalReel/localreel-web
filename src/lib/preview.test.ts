import assert from 'node:assert/strict'
import test from 'node:test'

import { cueAt, cueStyle, parsePreviewVtt, ratioOf } from './preview.ts'

const VTT = `WEBVTT

00:00:00.000 --> 00:00:10.000
/previews/abc.jpg#xywh=0,0,160,90

00:00:10.000 --> 00:00:20.000
/previews/abc.jpg#xywh=160,0,160,90
`

test('a sprite sheet parses into cues', () => {
  const sprite = parsePreviewVtt(VTT)
  assert.ok(sprite)
  assert.equal(sprite.url, '/previews/abc.jpg')
  assert.equal(sprite.cues.length, 2)
  assert.deepEqual(sprite.cues[1], {
    start: 10,
    end: 20,
    x: 160,
    y: 0,
    width: 160,
    height: 90,
  })
})

test('malformed documents return null instead of throwing', () => {
  assert.equal(parsePreviewVtt('not a vtt'), null)
  assert.equal(parsePreviewVtt('WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nno rectangle here'), null)
})

test('cue lookup clamps to the first and last cue', () => {
  const sprite = parsePreviewVtt(VTT)!
  assert.equal(cueAt(sprite, 0)?.start, 0)
  assert.equal(cueAt(sprite, 15)?.start, 10)
  assert.equal(cueAt(sprite, 999)?.start, 10)
})

test('cue style points at the right rectangle', () => {
  const sprite = parsePreviewVtt(VTT)!
  const style = cueStyle(sprite, sprite.cues[1])
  assert.equal(style.backgroundImage, 'url("/previews/abc.jpg")')
  assert.equal(style.backgroundPosition, '-160px -0px')
  assert.equal(style.width, '160px')
})

test('pointer ratios are clamped', () => {
  assert.equal(ratioOf(50, 0, 100), 0.5)
  assert.equal(ratioOf(-10, 0, 100), 0)
  assert.equal(ratioOf(200, 0, 100), 1)
  assert.equal(ratioOf(10, 0, 0), 0)
})
