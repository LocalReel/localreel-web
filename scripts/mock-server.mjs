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

      if (url.pathname === '/sample.webm') {
        await serveFile(request, response, fixture, 'video/webm')
        return
      }

      let pathname = url.pathname === '/' || url.pathname === '/watch' || url.pathname === '/admin'
        ? '/index.html'
        : url.pathname
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
  console.log(`mock LocalReel listening on http://127.0.0.1:${port}/watch`)
}
