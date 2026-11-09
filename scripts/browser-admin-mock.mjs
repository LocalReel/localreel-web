// Node 22 CDP smoke for the Admin plugin page: mock API + built UI.
// Verifies that the transport/sandbox badges and the verification chain render.

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
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const chromePath = chromeCandidates.find(candidate => existsSync(candidate))
if (!chromePath) {
  throw new Error('CHROME_PATH is required (or install Chrome/Chromium)')
}

const mock = await startMockServer()
const base = `http://127.0.0.1:${mock.port}`
const debugPort = 9400 + (process.pid % 100)
const profile = await mkdtemp(join(tmpdir(), 'localreel-cdp-admin-'))
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--window-size=1280,900',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
let chromeStderr = ''
chrome.stderr?.on('data', chunk => {
  chromeStderr = (chromeStderr + chunk).slice(-2000)
})

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

let socket
try {
  const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`).catch(error => {
    throw new Error(`${error.message}\nchrome stderr:\n${chromeStderr}`)
  })
  if (!version.webSocketDebuggerUrl) throw new Error('Chrome exposed no browser target')
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
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id == null || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      "try { localStorage.setItem('localreel.lang', 'en'); localStorage.setItem('localreel.ui', JSON.stringify({ lang: 'en' })) } catch {}",
  })
  await send('Page.navigate', { url: `${base}/admin/plugins` })

  const expected = [
    'Demo storage',
    'Transport: stdio',
    'OS isolated',
    'Verification log',
    'Chain valid',
    'Signed by host',
    'Staged packages',
    'Install',
  ]
  const deadline = Date.now() + 20000
  let text = ''
  while (Date.now() < deadline) {
    await sleep(250)
    const result = await send('Runtime.evaluate', {
      expression: 'document.body.innerText',
      returnByValue: true,
    })
    text = result.result?.value ?? ''
    if (expected.every(item => text.includes(item))) break
  }
  const missing = expected.filter(item => !text.includes(item))
  if (missing.length > 0) {
    throw new Error(`admin page is missing ${JSON.stringify(missing)}\nbody:\n${text.slice(0, 2000)}`)
  }

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    return result.result?.value
  }
  const clickButton = label =>
    evaluate(
      `(() => {
        const button = [...document.querySelectorAll('button')].find(
          item => item.textContent.trim() === ${JSON.stringify(label)},
        )
        if (!button || button.disabled) return false
        button.click()
        return true
      })()`,
    )
  const waitForText = async needle => {
    const until = Date.now() + 10000
    while (Date.now() < until) {
      const body = await evaluate('document.body.innerText')
      if (typeof body === 'string' && body.includes(needle)) return
      await sleep(200)
    }
    throw new Error(`admin page never showed ${JSON.stringify(needle)}`)
  }

  await evaluate('window.confirm = () => true')
  if (!(await clickButton('Install'))) {
    throw new Error('the Install button was missing or disabled')
  }
  await waitForText('restart the server to load it')
  if (!(await clickButton('Delete'))) {
    throw new Error('the Delete button was missing')
  }
  await waitForText('No staged packages')

  const requested = [
    '/api/v1/plugins',
    '/api/v1/plugins/sandbox-status',
    '/api/v1/plugins/verifications/verify',
    '/api/v1/plugins/packages',
  ]
  const missingRequests = requested.filter(
    path => !mock.requests.some(entry => entry.method === 'GET' && entry.path === path),
  )
  if (missingRequests.length > 0) {
    throw new Error(`admin page did not request ${JSON.stringify(missingRequests)}`)
  }
  const mutations = [
    { method: 'POST', path: '/api/v1/plugins/packages/install' },
    { method: 'DELETE', path: '/api/v1/plugins/packages/demo-storage/0.2.0' },
  ]
  const missingMutations = mutations.filter(
    expected => !mock.requests.some(entry => entry.method === expected.method && entry.path === expected.path),
  )
  if (missingMutations.length > 0) {
    throw new Error(`admin page did not send ${JSON.stringify(missingMutations)}`)
  }
  console.log(JSON.stringify({ ok: true, route: '/admin/plugins', expected, requests: mock.requests.length }))
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
  await rm(profile, { recursive: true, force: true })
}
