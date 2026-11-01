// Headless Chrome + DevTools Protocol assertion for Reels resume.
//
// Requires a running LocalReel server with at least one media item whose saved
// position is > 5 seconds. The first Reels item is used.
//
// Usage:
//   LOCALREEL_BASE_URL=http://127.0.0.1:3317 \
//   CHROME_PATH=C:/.../chrome.exe \
//   node scripts/browser-resume-test.mjs

import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = (process.env.LOCALREEL_BASE_URL ?? 'http://127.0.0.1:3317').replace(/\/$/, '')
const chromePath = process.env.CHROME_PATH
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9229)
const profile = await mkdtemp(join(tmpdir(), 'localreel-cdp-'))
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

if (!chromePath) {
  throw new Error('CHROME_PATH is required')
}

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

const firstPage = await fetch(`${base}/api/v1/media?limit=1`).then(response => response.json())
if (!firstPage.items?.length) {
  throw new Error('server has no media; scan a source first')
}
const media = firstPage.items[0]
const state = await fetch(`${base}/api/v1/media/${media.id}/state`).then(response =>
  response.json(),
)
const expected = state.position
if (!(expected > 5)) {
  throw new Error(`first media has no resumable position (${expected})`)
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
        "(() => { const v = document.querySelector('video'); return v ? { t: v.currentTime, d: v.duration, ready: v.readyState } : null; })()",
      returnByValue: true,
    })
    actual = result.result?.value ?? null
    if (actual && actual.ready >= 1 && Math.abs(actual.t - expected) < 3) break
  }

  if (!actual) {
    throw new Error('no <video> element in the Reels page')
  }
  if (Math.abs(actual.t - expected) >= 3) {
    throw new Error(
      `resume failed: expected currentTime≈${expected.toFixed(2)}, got ${actual.t.toFixed(2)} (duration ${actual.d})`,
    )
  }
  console.log(
    JSON.stringify({
      ok: true,
      media: media.filename,
      expected,
      actual: actual.t,
      duration: actual.d,
      readyState: actual.ready,
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
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' })
  }
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
