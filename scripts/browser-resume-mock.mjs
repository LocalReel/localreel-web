// Node 22 CDP smoke against the built UI + mock API/fixture.
// No LocalReel core build or ffmpeg is required.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { startMockServer } from './mock-server.mjs'

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)
const chromePath = chromeCandidates.find(candidate => existsSync(candidate))
if (!chromePath) {
  throw new Error('CHROME_PATH is required (or install Chrome/Chromium)')
}

const mock = await startMockServer()
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

async function waitForJson(url, timeoutMs = 15000) {
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

const chrome = spawn(chromePath, chromeArgs, { stdio: 'ignore' })
let socket
try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
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
  await send('Page.navigate', { url: `${base}/watch` })

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

  const stateRequested = mock.requests.some(
    entry => entry.method === 'GET' && entry.path === '/api/v1/media/1/state',
  )
  if (!stateRequested) {
    throw new Error('the UI never requested the media state')
  }
  if (!actual) {
    throw new Error('no <video> element in the Reels page')
  }
  if (Math.abs(actual.t - expected) >= 3) {
    throw new Error(
      `resume failed: expected currentTime≈${expected}, got ${actual.t} (duration ${actual.d})`,
    )
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
}
