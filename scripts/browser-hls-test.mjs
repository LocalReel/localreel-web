// Headless Chrome assertion for the HLS player mode.
//
// Requires a running LocalReel server with at least one media item.
//
// Usage:
//   LOCALREEL_BASE_URL=http://127.0.0.1:3199 \
//   CHROME_PATH=C:/.../chrome.exe \
//   node scripts/browser-hls-test.mjs

import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = (process.env.LOCALREEL_BASE_URL ?? 'http://127.0.0.1:3317').replace(/\/$/, '')
const chromePath = process.env.CHROME_PATH
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9231)
if (!chromePath) throw new Error('CHROME_PATH is required')

const profile = await mkdtemp(join(tmpdir(), 'localreel-hls-'))
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

const page = await fetch(`${base}/api/v1/media?limit=1`).then(response => response.json())
if (!page.items?.length) throw new Error('server has no media; scan a source first')

const chrome = spawn(chromePath, chromeArgs, { stdio: 'ignore' })
let socket
try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
  const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`)
  const target = targets.find(item => item.type === 'page')
  if (!target?.webSocketDebuggerUrl) throw new Error('no page target exposed by Chrome')

  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 0
  const pending = new Map()
  const requests = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Network.requestWillBeSent') {
      requests.push(message.params.request.url)
    }
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
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    return result.result?.value ?? null
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Page.navigate', { url: `${base}/` })

  // Open the first media card, then switch the player to HLS.
  const deadline = Date.now() + 30000
  let opened = false
  while (Date.now() < deadline && !opened) {
    await sleep(250)
    opened = await evaluate(
      "(() => { const card = document.querySelector('.card'); if (!card) return false; card.click(); return true; })()",
    )
  }
  if (!opened) throw new Error('no media card found on the library page')

  let clicked = false
  while (Date.now() < deadline && !clicked) {
    await sleep(250)
    clicked = await evaluate(
      "(() => { const button = [...document.querySelectorAll('button.mode')].find(b => b.textContent.trim() === 'HLS'); if (!button) return false; button.click(); return true; })()",
    )
  }
  if (!clicked) throw new Error('HLS button not found in the player')

  let state = null
  while (Date.now() < deadline) {
    await sleep(300)
    state = await evaluate(
      "(() => { const v = document.querySelector('video'); return v ? { t: v.currentTime, d: v.duration, ready: v.readyState, src: v.currentSrc } : null; })()",
    )
    if (state && state.ready >= 2 && state.t > 0.3) break
  }

  const playlist = requests.find(url => url.includes('.m3u8'))
  const segments = requests.filter(url => /\.ts(\?|$)/.test(url))
  if (!state) throw new Error('no <video> element after switching to HLS')
  if (!playlist) throw new Error(`no HLS playlist request (video state: ${JSON.stringify(state)})`)
  if (!segments.length) throw new Error('no HLS segment requests')
  if (!(state.ready >= 2 && state.t > 0.3)) {
    throw new Error(`HLS playback did not start: ${JSON.stringify(state)}`)
  }

  console.log(
    JSON.stringify({
      ok: true,
      media: page.items[0].filename,
      playlist,
      segments: segments.length,
      currentTime: state.t,
      duration: state.d,
      readyState: state.ready,
      videoSrc: state.src,
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
