import assert from 'node:assert/strict'
import test from 'node:test'

import { cueAt, cueStyle, parsePreviewVtt, ratioOf } from './preview.ts'

const SAMPLE = `WEBVTT

00:00:00.000 --> 00:00:06.000
/previews/abc.jpg#xywh=0,0,160,90

00:00:06.000 --> 00:00:12.000
/previews/abc.jpg#xywh=160,0,160,90

00:00:12.000 --> 00:01:00.000
/previews/abc.jpg#xywh=0,90,160,90
`

test('parses the sprite url and every cue', () => {
  const sprite = parsePreviewVtt(SAMPLE)
  assert.ok(sprite)
  assert.equal(sprite.url, '/previews/abc.jpg')
  assert.equal(sprite.cues.length, 3)
  assert.deepEqual(sprite.cues[1], {
    start: 6,
    end: 12,
    x: 160,
    y: 0,
    width: 160,
    height: 90,
  })
  assert.equal(sprite.cues[2].end, 60)
})

test('rejects documents that are not preview tracks', () => {
  assert.equal(parsePreviewVtt(''), null)
  assert.equal(parsePreviewVtt('not a vtt'), null)
  assert.equal(parsePreviewVtt('WEBVTT\n\n'), null)
  // A cue without the xywh rectangle cannot be drawn, so the document is empty.
  assert.equal(parsePreviewVtt('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nplain text\n'), null)
})

test('finds the cue covering a time and clamps at the edges', () => {
  const sprite = parsePreviewVtt(SAMPLE)
  assert.ok(sprite)
  assert.deepEqual(cueAt(sprite, 0), sprite.cues[0])
  assert.deepEqual(cueAt(sprite, -5), sprite.cues[0], 'before the start clamps up')
  assert.deepEqual(cueAt(sprite, 6.5), sprite.cues[1])
  assert.deepEqual(cueAt(sprite, 11.999), sprite.cues[1])
  assert.deepEqual(cueAt(sprite, 999), sprite.cues[2], 'after the end clamps down')
  assert.equal(cueAt({ url: '/x', cues: [] }, 1), null)
})

test('positions the sheet inside a fixed-size element', () => {
  const sprite = parsePreviewVtt(SAMPLE)
  assert.ok(sprite)
  const style = cueStyle(sprite, sprite.cues[1])
  assert.equal(style.backgroundImage, 'url("/previews/abc.jpg")')
  assert.equal(style.backgroundPosition, '-160px -0px')
  assert.equal(style.width, '160px')
  assert.equal(style.height, '90px')
})

test('clamps pointer ratios to the track', () => {
  assert.equal(ratioOf(50, 0, 100), 0.5)
  assert.equal(ratioOf(-1, 0, 100), 0)
  assert.equal(ratioOf(101, 0, 100), 1)
  assert.equal(ratioOf(50, 0, 0), 0)
})
