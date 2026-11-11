/**
 * A very small keyed cache for async reads.
 *
 * Why not a query library: the app needs exactly three behaviours — dedupe
 * concurrent reads of the same key, keep showing the previous value while a
 * refresh is in flight, and drop a family of keys when an SSE event says the
 * server changed something. Everything else would be unused weight in a
 * bundle the server embeds into its binary.
 *
 * Keys are strings with a `/`-separated shape (`media/page?filter=all`), so a
 * prefix invalidation can drop a family.
 */

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error'

export interface QueryEntry<T = unknown> {
  status: QueryStatus
  data?: T
  error?: unknown
  /** When the current data was fetched (epoch ms). */
  updatedAt: number
}

type Listener = () => void

const IDLE: QueryEntry = { status: 'idle', updatedAt: 0 }

export class QueryCache {
  private entries = new Map<string, QueryEntry>()
  private inflight = new Map<string, Promise<unknown>>()
  private listeners = new Map<string, Set<Listener>>()
  private globalListeners = new Set<Listener>()

  get<T>(key: string): QueryEntry<T> {
    return (this.entries.get(key) as QueryEntry<T> | undefined) ?? (IDLE as QueryEntry<T>)
  }

  /** Subscribe to one key. Returns the unsubscribe function. */
  subscribe(key: string, listener: Listener): () => void {
    let set = this.listeners.get(key)
    if (!set) {
      set = new Set()
      this.listeners.set(key, set)
    }
    set.add(listener)
    return () => {
      set?.delete(listener)
      if (set?.size === 0) this.listeners.delete(key)
    }
  }

  /** Subscribe to every key change, for cheap "is anything loading" counters. */
  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener)
    return () => this.globalListeners.delete(listener)
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach(listener => listener())
    this.globalListeners.forEach(listener => listener())
  }

  private write(key: string, entry: QueryEntry): void {
    this.entries.set(key, entry)
    this.notify(key)
  }

  /**
   * Read through the cache.
   *
   * Resolves with cached data when it is still fresh, otherwise starts (or
   * joins) one request. A refresh keeps the old value visible until the new one
   * lands, so a page never flashes empty while polling.
   */
  async load<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { staleTime?: number; force?: boolean } = {},
  ): Promise<T> {
    const staleTime = options.staleTime ?? 15_000
    const entry = this.get<T>(key)
    const fresh = entry.status === 'success' && Date.now() - entry.updatedAt < staleTime
    if (fresh && !options.force) return entry.data as T

    const existing = this.inflight.get(key)
    if (existing && !options.force) return existing as Promise<T>

    if (entry.status !== 'success') {
      this.write(key, { status: 'loading', data: entry.data as T, updatedAt: entry.updatedAt })
    }

    const promise = fetcher()
      .then(data => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key)
          this.write(key, { status: 'success', data, updatedAt: Date.now() })
        }
        return data
      })
      .catch(error => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key)
          this.write(key, { status: 'error', error, updatedAt: Date.now() })
        }
        throw error
      })

    this.inflight.set(key, promise)
    return promise
  }

  /** Drop one key or every key starting with `prefix`. */
  invalidate(prefixOrKey: string): void {
    const exact = this.entries.has(prefixOrKey)
    const keys = exact
      ? [prefixOrKey]
      : [...this.entries.keys()].filter(key => key.startsWith(prefixOrKey))
    for (const key of keys) {
      this.entries.delete(key)
      this.inflight.delete(key)
      this.notify(key)
    }
  }

  /** Write a value the client already knows (optimistic update). */
  put<T>(key: string, data: T): void {
    this.write(key, { status: 'success', data, updatedAt: Date.now() })
  }

  /** Patch a value in place without refetching. */
  patch<T>(key: string, update: (current: T | undefined) => T): void {
    const entry = this.get<T>(key)
    if (entry.status !== 'success') return
    this.put(key, update(entry.data))
  }

  clear(): void {
    this.entries.clear()
    this.inflight.clear()
    this.globalListeners.forEach(listener => listener())
  }

  /** Number of keys currently loading; used by the global progress hint. */
  get loadingCount(): number {
    let count = 0
    this.entries.forEach(entry => {
      if (entry.status === 'loading') count += 1
    })
    return count
  }
}

export const cache = new QueryCache()
