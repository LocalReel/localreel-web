import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { cache, type QueryEntry } from './cache'

export interface QueryResult<T> {
  data: T | undefined
  error: unknown
  /** True only while there is no data to show yet. */
  loading: boolean
  /** True while a refresh is in flight, even if stale data is on screen. */
  refreshing: boolean
  reload: (force?: boolean) => void
  set: (next: T) => void
}

/**
 * Read through the shared cache.
 *
 * `key` is the identity of the read; pass `null` to stay idle (for example
 * while a parameter is missing). `staleTime` follows the usual idea: inside the
 * window a remount reuses the value, outside it a refetch starts but the old
 * value stays visible.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { staleTime?: number; enabled?: boolean } = {},
): QueryResult<T> {
  const { staleTime = 15_000, enabled = true } = options

  const subscribe = useCallback(
    (listener: () => void) => (key ? cache.subscribe(key, listener) : () => {}),
    [key],
  )
  const snapshot = useCallback(
    () => (key ? cache.get<T>(key) : ({ status: 'idle', updatedAt: 0 } as QueryEntry<T>)),
    [key],
  )
  const entry = useSyncExternalStore(subscribe, snapshot, snapshot)

  // The fetcher identity changes on every render in most call sites, so keep it
  // in a ref and let the key decide when to re-run.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(
    (force: boolean) => {
      if (!key || !enabled) return
      void cache.load(key, () => fetcherRef.current(), { staleTime, force }).catch(() => {
        // The entry carries the error; nothing to do here.
      })
    },
    [enabled, key, staleTime],
  )

  useEffect(() => {
    if (!key || !enabled) return
    const current = cache.get<T>(key)
    // `idle` covers both a first mount and an entry dropped by an SSE
    // invalidation, which is why the status is part of the dependency list:
    // without that, a live update would blank the page instead of reloading it.
    if (current.status === 'idle') {
      run(false)
      return
    }
    if (current.status === 'success' && Date.now() - current.updatedAt > staleTime) {
      run(false)
    }
  }, [enabled, entry.status, entry.updatedAt, key, run, staleTime])

  const reload = useCallback(
    (force = true) => {
      run(force)
    },
    [run],
  )

  const set = useCallback(
    (next: T) => {
      if (key) cache.put(key, next)
    },
    [key],
  )

  return useMemo(
    () => ({
      data: entry.status === 'success' ? entry.data : undefined,
      error: entry.status === 'error' ? entry.error : undefined,
      loading: entry.status === 'loading' && entry.data === undefined,
      refreshing: entry.status === 'loading' && entry.data !== undefined,
      reload,
      set,
    }),
    [entry, reload, set],
  )
}

export interface MutationState {
  pending: boolean
  error: unknown
}

/**
 * Run a write and invalidate whatever the caller says it touched.
 *
 * Also reports the thrown error so the caller can render it inline instead of
 * throwing it into the void.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  run: (...args: TArgs) => Promise<TResult>,
  options: { invalidate?: string[]; onDone?: (result: TResult) => void } = {},
): [(...args: TArgs) => Promise<TResult | undefined>, MutationState] {
  const [state, setState] = useState<MutationState>({ pending: false, error: null })
  const runRef = useRef(run)
  runRef.current = run
  const invalidate = options.invalidate
  const onDone = options.onDone
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const execute = useCallback(
    async (...args: TArgs) => {
      setState({ pending: true, error: null })
      try {
        const result = await runRef.current(...args)
        invalidate?.forEach(prefix => cache.invalidate(prefix))
        onDoneRef.current?.(result)
        setState({ pending: false, error: null })
        return result
      } catch (error) {
        setState({ pending: false, error })
        return undefined
      }
    },
    [invalidate],
  )

  return [execute, state]
}

/** Debounce a value; used by the search field. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Re-render on an interval, paused while the tab is hidden. */
export function useInterval(callback: () => void, ms: number | null): void {
  const saved = useRef(callback)
  saved.current = callback
  useEffect(() => {
    if (ms == null) return
    const tick = () => {
      if (document.visibilityState === 'visible') saved.current()
    }
    const timer = window.setInterval(tick, ms)
    return () => window.clearInterval(timer)
  }, [ms])
}
