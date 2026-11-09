import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COVER_MAX_ASPECT,
  indexOfId,
  inSpeedZone,
  isLandscape,
  mergeFeedItems,
  objectFitForFeedItem,
  objectFitForVideo,
  preloadAhead,
  preloadIndexes,
  progressRatio,
  swipeDirection,
} from './feed.ts'

test('portrait and square frames fill the screen; landscape frames do not', () => {
  assert.equal(objectFitForVideo(1080, 1920), 'cover')
  assert.equal(objectFitForVideo(1000, 1000), 'cover')
  assert.equal(objectFitForVideo(1920, 1080), 'contain')
  assert.equal(objectFitForVideo(0, 0), 'contain')
  assert.equal(objectFitForVideo(Number.NaN, 100), 'contain')
})

test('the cover threshold is the documented ratio', () => {
  assert.equal(COVER_MAX_ASPECT, 1.05)
  assert.equal(objectFitForVideo(105, 100), 'cover')
  assert.equal(objectFitForVideo(106, 100), 'contain')
})

test('feed items without dimensions are never cropped', () => {
  assert.equal(objectFitForFeedItem({ width: null, height: null }), 'contain')
  assert.equal(objectFitForFeedItem({ width: 720, height: 1280 }), 'cover')
})

test('landscape detection matches the fullscreen affordance', () => {
  assert.equal(isLandscape(1920, 1080), true)
  assert.equal(isLandscape(1000, 1000), false)
  assert.equal(isLandscape(null, 1080), false)
})

test('a vertical drag is a swipe, a horizontal one is not', () => {
  assert.equal(swipeDirection(0, -80), 'next')
  assert.equal(swipeDirection(0, 80), 'prev')
  assert.equal(swipeDirection(0, -20), null)
  assert.equal(swipeDirection(120, -80), null)
})

test('the speed zone is the right third', () => {
  const rect = { left: 0, width: 300 }
  assert.equal(inSpeedZone(250, rect), true)
  assert.equal(inSpeedZone(150, rect), false)
  assert.equal(inSpeedZone(0, { left: 0, width: 0 }), false)
})

test('progress ratio is clamped', () => {
  assert.equal(progressRatio(30, 60), 0.5)
  assert.equal(progressRatio(-5, 60), 0)
  assert.equal(progressRatio(90, 60), 1)
  assert.equal(progressRatio(10, 0), 0)
})

test('feed merging keeps order and drops duplicates', () => {
  const current = [{ id: 1 }, { id: 2 }]
  assert.deepEqual(mergeFeedItems(current, []), current)
  assert.deepEqual(mergeFeedItems(current, [{ id: 2 }, { id: 3 }]), [{ id: 1 }, { id: 2 }, { id: 3 }])
  assert.equal(mergeFeedItems(current, [{ id: 1 }]), current)
})

test('preload window is clamped to the list', () => {
  assert.deepEqual(preloadIndexes(10, 0, 2), [0, 1, 2])
  assert.deepEqual(preloadIndexes(10, 9, 2), [9])
  assert.deepEqual(preloadIndexes(0, 0, 2), [])
})

test('a transcode two slides out shrinks the preload window', () => {
  const items = [
    { playback: 'direct' },
    { playback: 'direct' },
    { playback: 'transcode' },
  ]
  assert.equal(preloadAhead(items, 0), 1)
  assert.equal(preloadAhead([{ playback: 'direct' }], 0), 2)
})

test('index lookup', () => {
  assert.equal(indexOfId([{ id: 5 }, { id: 6 }], 6), 1)
  assert.equal(indexOfId([], 1), -1)
})
