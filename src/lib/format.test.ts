import assert from 'node:assert/strict'
import test from 'node:test'

import { formatBytes, formatDuration, formatSpan, watchedPercent } from './format.ts'

test('durations use m:ss and grow to h:mm:ss', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(65), '1:05')
  assert.equal(formatDuration(599), '9:59')
  assert.equal(formatDuration(3600), '1:00:00')
  assert.equal(formatDuration(5327), '1:28:47')
  assert.equal(formatDuration(-1), '--:--')
  assert.equal(formatDuration(null), '--:--')
  assert.equal(formatDuration(Number.NaN), '--:--')
})

test('spans stay compact', () => {
  assert.equal(formatSpan(59), '0m')
  assert.equal(formatSpan(60), '1m')
  assert.equal(formatSpan(3660), '1h 01m')
  assert.equal(formatSpan(90_000), '1d 1h')
  assert.equal(formatSpan(-1), '—')
})

test('bytes use binary units with a sensible precision', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1024), '1.00 KB')
  assert.equal(formatBytes(10 * 1024), '10.0 KB')
  assert.equal(formatBytes(1024 * 1024 * 3.5), '3.50 MB')
  assert.equal(formatBytes(null), '—')
})

test('watched percent is clamped and rounded', () => {
  assert.equal(watchedPercent(30, 60), 50)
  assert.equal(watchedPercent(0, 60), 0)
  assert.equal(watchedPercent(120, 60), 100)
  assert.equal(watchedPercent(10, 0), 0)
})
