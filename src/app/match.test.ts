import assert from 'node:assert/strict'
import test from 'node:test'

import { isActive, matchRoute, pathOf, routeHref, sectionOf } from './match.ts'

test('pathOf strips origin, query, hash and a trailing slash', () => {
  assert.equal(pathOf('/library'), '/library')
  assert.equal(pathOf('/library/'), '/library')
  assert.equal(pathOf('/show/abc?x=1'), '/show/abc')
  assert.equal(pathOf('http://127.0.0.1:5173/watch/42'), '/watch/42')
  assert.equal(pathOf(''), '/')
  assert.equal(pathOf('/'), '/')
})

test('every declared route matches its own pattern', () => {
  assert.equal(matchRoute('/').name, 'home')
  assert.equal(matchRoute('/library').name, 'library')
  assert.equal(matchRoute('/reels').name, 'reels')
  assert.equal(matchRoute('/admin').name, 'admin.overview')
  assert.equal(matchRoute('/admin/sources').name, 'admin.sources')
  assert.equal(matchRoute('/plugins').name, 'plugins')
  // The console host moved out of the admin tree; the app redirects the old path.
  assert.equal(matchRoute('/admin/plugins').name, 'notfound')
  assert.equal(matchRoute('/admin/settings').name, 'admin.settings')
})

test('path parameters are decoded', () => {
  const show = matchRoute('/show/9f2c%20a')
  assert.equal(show.name, 'show')
  assert.equal(show.params.id, '9f2c a')

  const watch = matchRoute('/watch/42')
  assert.equal(watch.name, 'watch')
  assert.equal(watch.params.id, '42')
})

test('unknown paths do not fall back to the home page', () => {
  assert.equal(matchRoute('/nope').name, 'notfound')
  assert.equal(matchRoute('/show').name, 'notfound')
  assert.equal(matchRoute('/admin/nope').name, 'notfound')
  // `/watchlist` must not be treated as `/watch`.
  assert.equal(matchRoute('/watchlist').name, 'notfound')
})

test('a malformed escape does not throw', () => {
  assert.equal(matchRoute('/show/%E0%A4%A').name, 'show')
})

test('routeHref builds and encodes paths', () => {
  assert.equal(routeHref('home'), '/')
  assert.equal(routeHref('library'), '/library')
  assert.equal(routeHref('watch', { id: 42 }), '/watch/42')
  assert.equal(routeHref('show', { id: 'a b' }), '/show/a%20b')
  assert.equal(routeHref('plugins'), '/plugins')
})

test('the plugin detail page keeps the plugins entry active', () => {
  const detail = matchRoute('/plugins/demo')
  assert.equal(detail.name, 'plugin')
  assert.equal(isActive(detail, 'plugins'), true)
  assert.equal(isActive(detail, 'admin.sources'), false)
})

test('sections group routes for the primary navigation', () => {
  assert.equal(sectionOf(matchRoute('/')), 'home')
  assert.equal(sectionOf(matchRoute('/library')), 'library')
  assert.equal(sectionOf(matchRoute('/show/x')), 'library')
  assert.equal(sectionOf(matchRoute('/reels')), 'reels')
  assert.equal(sectionOf(matchRoute('/watch/1')), 'none')
  assert.equal(sectionOf(matchRoute('/admin/jobs')), 'admin')
  assert.equal(sectionOf(matchRoute('/nope')), 'none')
})
