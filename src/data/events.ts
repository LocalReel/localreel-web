/**
 * Server-sent events.
 *
 * ADR-007 says the UI treats events as invalidation hints and refetches
 * authoritative data; that is exactly what happens here. The stream has no
 * `event:` names, only `data:` JSON with an in-band `type`, and a slow reader
 * silently misses events — so every consumer also refetches when the tab
 * becomes visible again.
 */

export type ServerEvent =
  | { type: 'server_started'; version: string }
  | {
      type: 'plugin_state_changed'
      id: string
      state: string
      running: boolean
      error?: string | null
    }
  | { type: 'job_queued' | 'job_started' | 'job_canceled' | 'job_finished'; job_id: string; kind: string }
  | { type: 'job_progress'; job_id: string; progress: number; message?: string | null }
  | { type: 'job_failed'; job_id: string; kind: string; error: string }

export interface EventStreamHandlers {
  onEvent: (event: ServerEvent) => void
  /** Called after a reconnect so state that changed while offline can reload. */
  onReconnect?: () => void
}

/**
 * Open the event stream for as long as the component is mounted.
 *
 * `EventSource` retries network failures by itself, but a server restart can
 * close the stream with a non-retryable state; the explicit retry below covers
 * that case with a short backoff instead of a busy loop.
 */
export function openEventStream(handlers: EventStreamHandlers): () => void {
  let source: EventSource | null = null
  let retry: number | null = null
  let closed = false
  let connectedBefore = false

  const connect = () => {
    if (closed) return
    source = new EventSource('/api/v1/events')
    source.onopen = () => {
      if (connectedBefore) handlers.onReconnect?.()
      connectedBefore = true
    }
    source.onmessage = message => {
      try {
        const parsed = JSON.parse(message.data) as ServerEvent
        if (parsed && typeof parsed.type === 'string') handlers.onEvent(parsed)
      } catch {
        // A malformed frame is not worth tearing the stream down for.
      }
    }
    source.onerror = () => {
      source?.close()
      source = null
      if (closed) return
      if (retry != null) window.clearTimeout(retry)
      retry = window.setTimeout(connect, 3000)
    }
  }

  connect()

  return () => {
    closed = true
    if (retry != null) window.clearTimeout(retry)
    source?.close()
  }
}

/**
 * Which cached reads a server event makes stale.
 *
 * Job events are the only high-traffic events today (there are no `scan.*` or
 * `media.*` events yet), so a finished job invalidates everything it could have
 * touched and leaves the rest alone.
 */
export function invalidatedBy(event: ServerEvent): string[] {
  switch (event.type) {
    case 'job_finished':
    case 'job_failed':
    case 'job_canceled':
      return ['media', 'series', 'feed', 'jobs', 'scans', 'cache', 'admin']
    case 'job_queued':
    case 'job_started':
      return ['jobs', 'admin']
    case 'plugin_state_changed':
      return ['plugins', 'admin']
    case 'server_started':
      return ['']
    default:
      return []
  }
}
