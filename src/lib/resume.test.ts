import assert from 'node:assert/strict'
import test from 'node:test'

import { isFinished, RESUME_THRESHOLD_SECONDS, resumeTarget } from './resume.ts'

test('the threshold is five seconds', () => {
  assert.equal(RESUME_THRESHOLD_SECONDS, 5)
})

test('nothing resumes within five seconds of either edge', () => {
  assert.equal(resumeTarget(0, 100), null)
  assert.equal(resumeTarget(5, 100), null)
  assert.equal(resumeTarget(96, 100), null)
  assert.equal(resumeTarget(100, 100), null)
})

test('a useful position is used, clamped away from the end', () => {
  assert.equal(resumeTarget(30, 100), 30)
  assert.equal(resumeTarget(94.5, 100), 94.5)
  assert.equal(resumeTarget(99, 100), null)
  assert.equal(resumeTarget(97, 100), null)
})

test('unknown durations never resume', () => {
  assert.equal(resumeTarget(30, 0), null)
  assert.equal(resumeTarget(Number.NaN, 100), null)
  assert.equal(resumeTarget(30, Number.POSITIVE_INFINITY), null)
})

test('finished means 95 percent or more', () => {
  assert.equal(isFinished(95, 100), true)
  assert.equal(isFinished(94.9, 100), false)
  assert.equal(isFinished(0, 100), false)
  assert.equal(isFinished(10, 0), false)
})
