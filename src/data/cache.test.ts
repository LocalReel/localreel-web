import assert from 'node:assert/strict'
import test from 'node:test'

import { QueryCache } from './cache.ts'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

for (const operation of ['force', 'invalidate', 'clear'] as const) {
  test(`${operation} prevents an old response from replacing new data`, async () => {
    const cache = new QueryCache()
    const old = deferred<string>()
    const pending = cache.load('k', () => old.promise)
    if (operation === 'invalidate') cache.invalidate('k')
    if (operation === 'clear') cache.clear()
    await cache.load('k', async () => 'new', { force: true })
    old.resolve('old')
    await pending
    assert.equal(cache.get('k').data, 'new')
  })
}

test('a superseded failure cannot erase current data', async () => {
  const cache = new QueryCache()
  const old = deferred<string>()
  const pending = cache.load('k', () => old.promise)
  const rejected = assert.rejects(pending)
  await cache.load('k', async () => 'new', { force: true })
  old.reject(new Error('stale error'))
  await rejected
  assert.equal(cache.get('k').data, 'new')
})

test('an old completion cannot clear the newer in-flight request', async () => {
  const cache = new QueryCache()
  const old = deferred<string>()
  const fresh = deferred<string>()
  const first = cache.load('k', () => old.promise)
  const second = cache.load('k', () => fresh.promise, { force: true })
  old.resolve('old')
  await first
  let duplicate = false
  const joined = cache.load('k', async () => { duplicate = true; return 'duplicate' })
  fresh.resolve('new')
  assert.equal(await joined, 'new')
  await second
  assert.equal(duplicate, false)
})

test('a fresh value is returned without calling the fetcher again', async () => {
  const cache = new QueryCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return 'value'
  }

  assert.equal(await cache.load('k', fetcher, { staleTime: 10_000 }), 'value')
  assert.equal(await cache.load('k', fetcher, { staleTime: 10_000 }), 'value')
  assert.equal(calls, 1)
})

test('concurrent reads of one key share a single request', async () => {
  const cache = new QueryCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    await tick()
    return calls
  }

  const [a, b] = await Promise.all([cache.load('k', fetcher), cache.load('k', fetcher)])
  assert.equal(calls, 1)
  assert.equal(a, 1)
  assert.equal(b, 1)
})

test('a stale value is refetched but the old value stays readable meanwhile', async () => {
  const cache = new QueryCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return `v${calls}`
  }

  await cache.load('k', fetcher, { staleTime: 0 })
  const next = cache.load('k', fetcher, { staleTime: 0 })
  // While the second request is in flight the entry still carries the first.
  assert.equal(cache.get<string>('k').data, 'v1')
  assert.equal(await next, 'v2')
  assert.equal(cache.get<string>('k').data, 'v2')
})

test('a forced reload bypasses the cache', async () => {
  const cache = new QueryCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return calls
  }
  await cache.load('k', fetcher)
  await cache.load('k', fetcher, { force: true })
  assert.equal(calls, 2)
})

test('errors are stored and surfaced', async () => {
  const cache = new QueryCache()
  const boom = new Error('nope')
  await assert.rejects(cache.load('k', async () => Promise.reject(boom)))
  const entry = cache.get('k')
  assert.equal(entry.status, 'error')
  assert.equal(entry.error, boom)
})

test('invalidate drops a family by prefix and notifies', async () => {
  const cache = new QueryCache()
  await cache.load('media:list:a', async () => 'a')
  await cache.load('media:list:b', async () => 'b')
  await cache.load('series', async () => 's')

  let notified = 0
  cache.subscribe('media:list:a', () => {
    notified += 1
  })

  cache.invalidate('media:')
  assert.equal(notified, 1)
  assert.equal(cache.get('media:list:a').status, 'idle')
  assert.equal(cache.get('media:list:b').status, 'idle')
  assert.equal(cache.get('series').status, 'success')
})

test('invalidate with an exact key only drops that key', async () => {
  const cache = new QueryCache()
  await cache.load('media:list', async () => 1)
  await cache.load('media:list:2', async () => 2)
  cache.invalidate('media:list')
  assert.equal(cache.get('media:list').status, 'idle')
  assert.equal(cache.get('media:list:2').status, 'success')
})

test('put and patch update without a request', async () => {
  const cache = new QueryCache()
  cache.put('state:1', { liked: false, position: 10 })
  cache.patch<{ liked: boolean; position: number }>('state:1', current => ({
    liked: true,
    position: current?.position ?? 0,
  }))
  assert.deepEqual(cache.get('state:1').data, { liked: true, position: 10 })
})
