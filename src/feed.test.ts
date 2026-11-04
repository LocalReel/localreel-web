import assert from 'node:assert/strict'
import test from 'node:test'

import type { FeedItem } from './api.ts'
import {
  COVER_MIN_ASPECT,
  feedDisplayTitle,
  feedItemFromMedia,
  formatClock,
  indexOfId,
  mergeFeedItems,
  objectFitForFeedItem,
  objectFitForVideo,
  preloadIndexes,
  progressRatio,
  swipeDirection,
} from './feed.ts'

function feedItem(id: number, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    title: null,
    filename: `clip-${id}.mp4`,
    series_key: null,
    series_title: null,
    episode: null,
    width: 1920,
    height: 1080,
    duration: 100,
    position: 0,
    finished: false,
    favorite: false,
    liked: false,
    next_id: null,
    created_at: 0,
    ...overrides,
  }
}

test('wide frames are full-bleed, narrow frames keep the whole picture', () => {
  assert.equal(COVER_MIN_ASPECT, 1.55)
  assert.equal(objectFitForVideo(1920, 1080), 'cover')
  assert.equal(objectFitForVideo(1280, 720), 'cover')
  assert.equal(objectFitForVideo(3840, 2160), 'cover')
  // Exactly at the threshold counts as wide.
  assert.equal(objectFitForVideo(1550, 1000), 'cover')
  assert.equal(objectFitForVideo(1549, 1000), 'contain')
  // 4:3, 1.5:1 and portrait phone clips are contained so nothing is cropped.
  assert.equal(objectFitForVideo(1440, 1080), 'contain')
  assert.equal(objectFitForVideo(1500, 1000), 'contain')
  assert.equal(objectFitForVideo(1080, 1920), 'contain')
  assert.equal(objectFitForVideo(320, 240), 'contain')
  // Unknown metadata falls back to the non-cropping mode.
  assert.equal(objectFitForVideo(0, 0), 'contain')
  assert.equal(objectFitForVideo(Number.NaN, 1080), 'contain')
  assert.equal(objectFitForVideo(-1920, 1080), 'contain')
})

test('objectFitForFeedItem uses ffprobe dimensions and tolerates nulls', () => {
  assert.equal(objectFitForFeedItem({ width: 1920, height: 1080 }), 'cover')
  assert.equal(objectFitForFeedItem({ width: 320, height: 240 }), 'contain')
  assert.equal(objectFitForFeedItem({ width: 1080, height: 1920 }), 'contain')
  // Unknown dimensions fall back to the non-cropping mode until the video
  // element reports its own metadata.
  assert.equal(objectFitForFeedItem({ width: null, height: null }), 'contain')
  assert.equal(objectFitForFeedItem({ width: 1920, height: null }), 'contain')
})

test('formatClock renders m:ss and h:mm:ss', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(10), '0:10')
  assert.equal(formatClock(59), '0:59')
  assert.equal(formatClock(754), '12:34')
  assert.equal(formatClock(3599), '59:59')
  assert.equal(formatClock(3600), '1:00:00')
  assert.equal(formatClock(3661.9), '1:01:01')
  // A 5327.3 s movie is 1:28:47, not 88:47.
  assert.equal(formatClock(5327.338667), '1:28:47')
})

test('formatClock rejects missing and invalid values', () => {
  assert.equal(formatClock(null), '--:--')
  assert.equal(formatClock(undefined), '--:--')
  assert.equal(formatClock(Number.NaN), '--:--')
  assert.equal(formatClock(Number.POSITIVE_INFINITY), '--:--')
  assert.equal(formatClock(-5), '--:--')
})

test('progressRatio clamps to the 0..1 range', () => {
  assert.equal(progressRatio(0, 100), 0)
  assert.equal(progressRatio(50, 100), 0.5)
  assert.equal(progressRatio(100, 100), 1)
  assert.equal(progressRatio(150, 100), 1)
  assert.equal(progressRatio(-10, 100), 0)
  assert.equal(progressRatio(50, 0), 0)
  assert.equal(progressRatio(Number.NaN, 100), 0)
  assert.equal(progressRatio(50, Number.NaN), 0)
})

test('swipeDirection only reports vertical-dominant drags', () => {
  assert.equal(swipeDirection(8, -80), 'next')
  assert.equal(swipeDirection(-12, 120), 'prev')
  // Too short to be a swipe.
  assert.equal(swipeDirection(0, -30), null)
  // Horizontal drags belong to seeking, not navigation.
  assert.equal(swipeDirection(200, -80), null)
  assert.equal(swipeDirection(-80, 60), null)
  assert.equal(swipeDirection(0, 0), null)
  // A custom threshold lets tests (and the progress bar) be stricter.
  assert.equal(swipeDirection(4, -40, 30), 'next')
  assert.equal(swipeDirection(4, -20, 30), null)
  assert.equal(swipeDirection(Number.NaN, -80), null)
})

test('indexOfId finds loaded items and reports misses', () => {
  const items = [feedItem(7), feedItem(9), feedItem(12)]
  assert.equal(indexOfId(items, 7), 0)
  assert.equal(indexOfId(items, 12), 2)
  assert.equal(indexOfId(items, 8), -1)
  assert.equal(indexOfId([], 7), -1)
})

test('mergeFeedItems appends only unknown ids and keeps identity when idle', () => {
  const current = [feedItem(1), feedItem(2)]
  assert.equal(mergeFeedItems(current, []), current)
  // Nothing new: same reference so callers can skip a state update.
  assert.equal(mergeFeedItems(current, [feedItem(2)]), current)

  const merged = mergeFeedItems(current, [feedItem(2), feedItem(3), feedItem(4)])
  assert.deepEqual(
    merged.map(item => item.id),
    [1, 2, 3, 4],
  )
  assert.notEqual(merged, current)
  assert.equal(current.length, 2, 'the input array must not be mutated')
})

test('preloadIndexes keeps the active slide plus the next two warm', () => {
  assert.deepEqual(preloadIndexes(10, 0), [0, 1, 2])
  assert.deepEqual(preloadIndexes(10, 5), [5, 6, 7])
  assert.deepEqual(preloadIndexes(10, 8), [8, 9])
  assert.deepEqual(preloadIndexes(10, 9), [9])
  assert.deepEqual(preloadIndexes(1, 0), [0])
  assert.deepEqual(preloadIndexes(0, 0), [])
  // Out-of-range active values are clamped into the feed.
  assert.deepEqual(preloadIndexes(10, 99), [9])
  assert.deepEqual(preloadIndexes(10, -3), [0, 1, 2])
  // ahead=0 only preloads the active slide.
  assert.deepEqual(preloadIndexes(10, 4, 0), [4])
})

test('feedDisplayTitle prefers the title and strips known extensions', () => {
  assert.equal(feedDisplayTitle({ title: 'Episode 1', filename: 'x.mkv' }), 'Episode 1')
  assert.equal(feedDisplayTitle({ title: '   ', filename: 'raw.mkv' }), 'raw')
  assert.equal(
    feedDisplayTitle({ title: null, filename: '[Group] Show [01][1080p].mp4' }),
    '[Group] Show [01][1080p]',
  )
  assert.equal(feedDisplayTitle({ title: null, filename: 'no-extension' }), 'no-extension')
})

test('feedItemFromMedia fills the fallback item without series metadata', () => {
  const item = feedItemFromMedia({
    id: 42,
    title: 'Fallback',
    filename: 'fallback.mp4',
    duration: 125.5,
    width: 1280,
    height: 720,
  })
  assert.equal(item.id, 42)
  assert.equal(item.title, 'Fallback')
  assert.equal(item.filename, 'fallback.mp4')
  assert.equal(item.duration, 125.5)
  assert.equal(item.width, 1280)
  assert.equal(item.height, 720)
  assert.equal(item.position, 0)
  assert.equal(item.next_id, null)
  assert.equal(item.series_title, null)
  assert.equal(item.episode, null)
  assert.equal(item.finished, false)
  assert.equal(item.liked, false)
  assert.equal(item.favorite, false)

  // A media row without a duration still yields a usable feed item.
  assert.equal(
    feedItemFromMedia({
      id: 1,
      title: null,
      filename: 'a.mp4',
      duration: null,
      width: null,
      height: null,
    }).duration,
    0,
  )
})
