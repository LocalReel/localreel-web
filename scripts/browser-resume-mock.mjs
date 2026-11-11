// Node 22 CDP smoke against the built UI + mock API/fixture.
// No LocalReel core build is required; only the HLS fixture needs ffmpeg, and
// that binary comes from the `ffmpeg-static` dev dependency unless FFMPEG_PATH
// points somewhere else.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { startMockServer } from './mock-server.mjs'

/** A static ffmpeg keeps CI off the system package manager. */
function bundledFfmpeg() {
  try {
    const require = createRequire(import.meta.url)
    const path = require('ffmpeg-static')
    return typeof path === 'string' && existsSync(path) ? path : null
  } catch {
    return null
  }
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const chromePath = chromeCandidates.find(candidate => existsSync(candidate))
if (!chromePath) {
  throw new Error('CHROME_PATH is required (or install Chrome/Chromium)')
}

const hls = process.argv.includes('--hls')
const watch = process.argv.includes('--watch') || hls
const hlsRoot = hls ? await mkdtemp(join(tmpdir(), 'localreel-hls-fixture-')) : null
if (hlsRoot) {
  const ffmpeg = process.env.FFMPEG_PATH ?? bundledFfmpeg() ?? 'ffmpeg'
  const generated = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=10',
    '-t', '180', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '20',
    '-hls_time', '2', '-hls_list_size', '0', '-hls_segment_filename', join(hlsRoot, 'segment%d.ts'),
    join(hlsRoot, 'index.m3u8'),
  ], { stdio: 'inherit' })
  if (generated.status !== 0) throw new Error(`ffmpeg HLS fixture generation failed (${ffmpeg})`)
}
const mock = await startMockServer({ playbackDelay: watch ? 300 : 0, hlsRoot })
const base = `http://127.0.0.1:${mock.port}`
const expected = 165
const debugPort = 9300 + (process.pid % 100)
const profile = await mkdtemp(join(tmpdir(), 'localreel-cdp-mock-'))
const chromeArgs = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  'about:blank',
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForJson(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch (error) {
      lastError = error
    }
    await sleep(200)
  }
  throw new Error(`timed out waiting for ${url}: ${lastError ?? 'no response'}`)
}

const mediaPage = await fetch(`${base}/api/v1/media`).then(response => response.json())
if (!mediaPage.items?.length) {
  throw new Error('mock server returned no media')
}

const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] })
// Keep a short tail of Chrome's stderr: a launch failure is otherwise just a
// timeout with no explanation.
let chromeStderr = ''
chrome.stderr?.on('data', chunk => {
  chromeStderr = (chromeStderr + chunk).slice(-2000)
})
let socket
try {
  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
  } catch (error) {
    throw new Error(`${error.message}\nchrome exited=${chrome.exitCode} stderr:\n${chromeStderr}`, { cause: error })
  }
  const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`)
  const target = targets.find(item => item.type === 'page')
  if (!target?.webSocketDebuggerUrl) {
    throw new Error('no page target exposed by Chrome')
  }

  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id != null && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    }
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  if (hls) {
    // Exercise the hls.js/MSE branch even on Chromium builds with native HLS.
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `const original = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function(type) {
          return /mpegurl/i.test(type) ? '' : original.call(this, type);
        };`,
    })
  }
  await send('Page.navigate', { url: `${base}/${watch ? 'watch/1' : 'reels'}` })

  const deadline = Date.now() + 20000
  let actual = null
  while (Date.now() < deadline) {
    await sleep(250)
    const result = await send('Runtime.evaluate', {
      expression:
        "(() => { const v = document.querySelector('video'); return v ? { t: v.currentTime, d: v.duration, ready: v.readyState, src: v.currentSrc } : null; })()",
      returnByValue: true,
    })
    actual = result.result?.value ?? null
    if (actual && actual.ready >= 1 && Math.abs(actual.t - expected) < 3) break
  }

  // The feed carries the saved position, so resume must work from `/api/v1/feed`
  // without a second per-item state request.
  const feedRequested = mock.requests.some(
    entry => entry.method === 'GET' && entry.path === '/api/v1/feed',
  )
  if (!feedRequested) {
    throw new Error('the UI never requested the feed')
  }
  if (!actual) {
    throw new Error('no <video> element in the Reels page')
  }
  if (Math.abs(actual.t - expected) >= 3) {
    throw new Error(
      `resume failed: expected currentTime≈${expected}, got ${actual.t} (duration ${actual.d})`,
    )
  }
  if (hls && !mock.requests.some(entry => /segment\d+\.ts$/.test(entry.path))) {
    throw new Error('HLS player never requested a segment')
  }
  if (watch && !hls) {
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result?.value
    }
    await evaluate(`(() => {
      const video = document.querySelector('video');
      video.pause(); video.currentTime = 220;
      video.dispatchEvent(new Event('timeupdate'));
      video.dispatchEvent(new Event('pause'));
    })()`)
    await sleep(200)
    const slider = await evaluate(`document.querySelector('[role="slider"]').getAttribute('aria-valuenow')`)
    if (Number(slider) !== 220) throw new Error(`timeupdate listener missing: ${slider}`)
    if (!mock.requests.some(entry => entry.method === 'PUT' && entry.path === '/api/v1/media/1/state')) {
      throw new Error('progress flush was not sent')
    }
    const keyboardAllowed = await evaluate(`(() => {
      const button = document.querySelector('button[aria-pressed]');
      button.focus();
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      return !event.defaultPrevented;
    })()`)
    if (!keyboardAllowed) throw new Error('player shortcuts intercepted button Space')
    await evaluate(`document.querySelector('header button').click()`)
    await sleep(150)
    await evaluate(`(() => {
      document.querySelector('[role="dialog"] select').focus();
      document.querySelector('video').dispatchEvent(new Event('timeupdate'));
    })()`)
    await sleep(100)
    if (!await evaluate(`document.activeElement?.tagName === 'SELECT'`)) {
      throw new Error('dialog stole focus on a player rerender')
    }
    await evaluate(`document.querySelector('[role="dialog"] button').click()`)
    await evaluate(`(() => {
      history.pushState(null, '', '/watch/2');
      window.dispatchEvent(new Event('localreel:navigate'));
    })()`)
    const nextDeadline = Date.now() + 15000
    let nextTime = 0
    while (Date.now() < nextDeadline) {
      nextTime = await evaluate(`document.querySelector('video')?.currentTime ?? 0`)
      if (Math.abs(nextTime - 40) < 3) break
      await sleep(150)
    }
    if (Math.abs(nextTime - 40) >= 3) throw new Error(`next item inherited old resume: ${nextTime}`)
    await evaluate(`document.querySelector('video').dispatchEvent(new Event('error'))`)
    await sleep(100)
    if (!await evaluate(`!!document.querySelector('[role="status"] button')`)) {
      throw new Error('runtime media error has no retry UI')
    }
  }
  console.log(
    JSON.stringify({
      ok: true,
      media: 'mock sample.webm',
      expected,
      actual: actual.t,
      duration: actual.d,
      readyState: actual.ready,
      src: actual.src,
    }),
  )
} finally {
  try {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 9999, method: 'Browser.close', params: {} }))
    }
  } catch {
    // best effort
  }
  await sleep(500)
  if (chrome.pid) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      chrome.kill('SIGKILL')
      spawnSync('pkill', ['-f', `user-data-dir=${profile}`], { stdio: 'ignore' })
    }
  }
  await mock.close()
  await rm(profile, { recursive: true, force: true }).catch(() => {})
  if (hlsRoot) await rm(hlsRoot, { recursive: true, force: true }).catch(() => {})
}
