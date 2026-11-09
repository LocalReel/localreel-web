// Tiny mock LocalReel server used by the browser resume smoke test.
// It serves the built web UI, one mock media row/state, and a 1450s WebM
// fixture, so CI can exercise the real Reels component without a core build.

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const distRoot = resolve(here, '..', 'dist')
const fixture = resolve(here, 'fixtures', 'sample.webm')

const media = {
  id: 1,
  uid: 'mock-uid',
  source_id: 1,
  uri: 'file:///mock/sample.webm',
  canonical_path: 'sample.webm',
  filename: 'sample.webm',
  title: 'Mock Reel',
  duration: 1450,
  width: 160,
  height: 90,
  codec_video: 'vp9',
  codec_audio: null,
  size_bytes: 35526,
  created_at: 0,
  updated_at: 0,
}

const state = {
  media_id: 1,
  liked: false,
  favorite: false,
  position: 165,
  duration: 1450,
  updated_at: 0,
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webm': 'video/webm',
  '.json': 'application/json',
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(body)
}

async function serveFile(request, response, path, contentType) {
  const info = await stat(path)
  const range = request.headers.range
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [startText, endText] = range.slice(6).split('-')
    const start = startText ? Number(startText) : 0
    const end = endText ? Math.min(Number(endText), info.size - 1) : info.size - 1
    if (start > end || start >= info.size) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` })
      response.end()
      return
    }
    response.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${info.size}`,
      'Accept-Ranges': 'bytes',
    })
    createReadStream(path, { start, end }).pipe(response)
    return
  }
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': info.size,
    'Accept-Ranges': 'bytes',
  })
  createReadStream(path).pipe(response)
}

export async function startMockServer() {
  const requests = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    requests.push({ method: request.method, path: url.pathname })
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    )
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')

    try {
      // Since ADR-013 the UI renders a sign-in gate first; without this the
      // smoke test would only ever see the login screen.
      if (url.pathname === '/api/v1/auth/status') {
        sendJson(response, 200, {
          setup_required: false,
          authenticated: true,
          user: { id: 1, username: 'owner', role: 'admin' },
          mode: 'server',
        })
        return
      }
      if (url.pathname === '/api/v1/plugins') {
        sendJson(response, 200, {
          plugins: [
            {
              id: 'demo-storage',
              name: 'Demo storage',
              version: '0.1.0',
              permissions: ['fs.read'],
              network: false,
              running: true,
              state: 'running',
              enabled: true,
              restarts: 0,
              generation: 1,
              package: 'demo-storage-0.1.0.lrplug',
              transport: 'stdio',
              sandbox: 'appcontainer',
            },
          ],
        })
        return
      }
      if (url.pathname === '/api/v1/plugins/sandbox-status') {
        sendJson(response, 200, {
          platform: process.platform === 'win32' ? 'windows' : process.platform,
          app_container: true,
          wrapper_present: true,
          unshare_present: false,
        })
        return
      }
      if (url.pathname === '/api/v1/plugins/verifications') {
        sendJson(response, 200, {
          entries: [
            {
              id: 2,
              plugin_id: 'demo-storage',
              plugin_version: '0.1.0',
              package_sha256: 'a'.repeat(64),
              publisher: 'acme',
              public_key_fingerprint: 'b'.repeat(64),
              signature_verified: true,
              at: 0,
              chain_hash: 'c'.repeat(64),
            },
          ],
        })
        return
      }
      if (url.pathname === '/api/v1/plugins/verifications/verify') {
        sendJson(response, 200, {
          checked: 1,
          valid: true,
          broken_at: null,
          anchored: true,
          anchor_valid: true,
        })
        return
      }
      if (url.pathname === '/api/v1/plugins/packages') {
        sendJson(response, 200, {
          packages: [
            {
              id: 'demo-storage',
              version: '0.2.0',
              path: 'data/plugins/packages/demo-storage/0.2.0.lrplug',
              metadata: {
                sha256: 'a'.repeat(64),
                publisher: 'acme',
                signature_verified: true,
                staged_at: 0,
              },
            },
          ],
        })
        return
      }
      if (url.pathname === '/api/v1/plugins/packages/install') {
        sendJson(response, 200, { restart_required: true })
        return
      }
      if (url.pathname.startsWith('/api/v1/plugins/packages/')) {
        sendJson(response, 200, { deleted: true })
        return
      }
      if (url.pathname === '/api/v1/feed') {
        sendJson(response, 200, {
          items: [
            {
              id: media.id,
              title: media.title,
              filename: media.filename,
              series_key: null,
              series_title: null,
              episode: null,
              width: media.width,
              height: media.height,
              duration: media.duration,
              position: state.position,
              finished: false,
              favorite: state.favorite,
              liked: state.liked,
              playback: 'direct',
              next_id: null,
              created_at: 0,
              thumbnail_path: null,
            },
          ],
          total: 1,
        })
        return
      }
      if (url.pathname === '/api/v1/media') {
        sendJson(response, 200, { items: [media], total: 1, next_cursor: null })
        return
      }
      if (url.pathname === '/api/v1/media/1/state') {
        if (request.method === 'POST' || request.method === 'PUT') {
          let body = ''
          for await (const chunk of request) body += chunk
          if (body) Object.assign(state, JSON.parse(body))
        }
        sendJson(response, 200, state)
        return
      }
      if (url.pathname === '/api/v1/media/1/playback') {
        sendJson(response, 200, { mode: 'direct', url: '/sample.webm' })
        return
      }
      if (url.pathname === '/api/v1/health') {
        sendJson(response, 200, { status: 'ok', version: 'mock', media_count: 1 })
        return
      }
      if (url.pathname === '/api/v1/media/1/tracks') {
        sendJson(response, 200, [])
        return
      }
      if (url.pathname === '/sample.webm') {
        await serveFile(request, response, fixture, 'video/webm')
        return
      }
      if (url.pathname === '/api/v1/series') {
        sendJson(response, 200, { items: [], total: 0 })
        return
      }
      if (url.pathname === '/api/v1/events') {
        // The real server keeps this open; a 204 tells EventSource to stop
        // retrying, which is what a smoke test wants.
        response.writeHead(204)
        response.end()
        return
      }
      if (url.pathname === '/api/v1/admin/health') {
        sendJson(response, 200, {
          name: 'LocalReel',
          status: 'ok',
          version: 'mock',
          mode: 'server',
          database: true,
          ffmpeg: true,
          ffmpeg_capability: 'full',
          hwaccel: null,
          media_count: 1,
          data_dir: '/tmp',
          thumbnail_dir: '/tmp',
          transcode_dir: '/tmp',
          watchers: { enabled: true, active: 0, skipped: [] },
          transcodes: { running: 0, queued: 0, limit: 2, sessions: 0 },
          jobs: [],
        })
        return
      }
      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: { code: 'not_found', message: `${url.pathname} not found` } })
        return
      }

      // SPA fallback: the server answers any HTML path with the shell, so a
      // client route survives a reload. Mirrors `spa_fallback` in the core.
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(url.pathname)
      const pathname = hasExtension ? url.pathname : '/index.html'
      const file = resolve(distRoot, `.${pathname}`)
      if (!file.startsWith(distRoot + sep) && file !== join(distRoot, 'index.html')) {
        sendJson(response, 403, { error: 'forbidden' })
        return
      }
      await serveFile(request, response, file, mime[extname(file)] ?? 'application/octet-stream')
    } catch (error) {
      sendJson(response, 404, { error: String(error) })
    }
  })

  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const { port } = server.address()
  return {
    server,
    port,
    requests,
    close: () => new Promise(resolveClose => server.close(resolveClose)),
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { port } = await startMockServer()
  console.log(`mock LocalReel listening on http://127.0.0.1:${port}/reels`)
}
