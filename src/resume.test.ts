import assert from 'node:assert/strict'
import test from 'node:test'

import { resumeTarget } from './resume.ts'

test('resumes a position in the middle', () => {
  assert.equal(resumeTarget(165, 1450), 165)
  assert.equal(resumeTarget(42, 100), 42)
})

test('rejects positions near the start or end', () => {
  assert.equal(resumeTarget(0, 100), null)
  assert.equal(resumeTarget(5, 100), null)
  assert.equal(resumeTarget(96, 100), null)
  assert.equal(resumeTarget(100, 100), null)
})

test('clamps to the last safe second', () => {
  assert.equal(resumeTarget(94.5, 100), 94.5)
  assert.equal(resumeTarget(95, 100), null)
})

test('rejects invalid durations and positions', () => {
  assert.equal(resumeTarget(10, 0), null)
  assert.equal(resumeTarget(10, -1), null)
  assert.equal(resumeTarget(Number.NaN, 100), null)
  assert.equal(resumeTarget(10, Number.POSITIVE_INFINITY), null)
})
