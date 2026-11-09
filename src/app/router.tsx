import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react'

import { matchRoute, pathOf, searchOf, type RouteMatch } from './match'

/**
 * Minimal history router.
 *
 * The server serves the SPA shell for any unmatched HTML path, so real URLs are
 * safe to share and refresh. `pushState` does not fire `popstate`, so the store
 * notifies its own subscribers; both paths funnel into the same listener set.
 */

const NAVIGATE_EVENT = 'localreel:navigate'
const scrollPositions = new Map<string, number>()

function currentUrl(): string {
  return window.location.pathname + window.location.search
}

function subscribe(listener: () => void): () => void {
  const onPop = () => listener()
  const onNavigate = () => listener()
  window.addEventListener('popstate', onPop)
  window.addEventListener(NAVIGATE_EVENT, onNavigate)
  return () => {
    window.removeEventListener('popstate', onPop)
    window.removeEventListener(NAVIGATE_EVENT, onNavigate)
  }
}

function snapshot(): string {
  return currentUrl()
}

/** The full current URL (path + query without the hash). */
export function useLocation(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '/')
}

/** The matched route for the current URL. */
export function useRoute(): RouteMatch {
  const url = useLocation()
  return useMemo(() => matchRoute(url), [url])
}

export interface NavigateOptions {
  replace?: boolean
  /** Keep the scroll offset (used when only a query string changes). */
  keepScroll?: boolean
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  const next = to.startsWith('http') ? pathOf(to) + searchOf(to) : to
  const before = currentUrl()
  if (options.replace) {
    window.history.replaceState(null, '', next)
  } else {
    window.history.pushState(null, '', next)
  }
  if (!options.keepScroll && pathOf(before) !== pathOf(next)) {
    scrollPositions.set(pathOf(before), window.scrollY)
    window.scrollTo(0, 0)
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

/** Restore the previous scroll offset when the user goes back. */
export function useScrollRestoration(): void {
  const url = useLocation()
  const previous = useRef<string>('')
  useEffect(() => {
    const path = pathOf(url)
    if (previous.current && previous.current !== path) {
      // A fresh navigation already scrolled to the top in `navigate`; only a
      // popstate needs the remembered offset, which is stored on the way out.
      const remembered = scrollPositions.get(path)
      if (remembered != null) window.scrollTo(0, remembered)
    }
    previous.current = path
  }, [url])
}

export interface QueryValue {
  get(name: string): string | null
  set(name: string, value: string | null): void
}

/** Read/write one query parameter without leaving the current route. */
export function useQueryParam(name: string): [string | null, (value: string | null) => void] {
  const url = useLocation()
  const value = useMemo(() => new URLSearchParams(searchOf(url)).get(name), [url, name])
  const set = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchOf(url))
      if (next == null || next === '') params.delete(name)
      else params.set(name, next)
      const query = params.toString()
      navigate(`${pathOf(url)}${query ? `?${query}` : ''}`, { keepScroll: true, replace: true })
    },
    [name, url],
  )
  return [value, set]
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  children: ReactNode
}

/**
 * Internal link. Renders a real anchor so middle-click, copy-link and
 * "open in new tab" keep working; the click handler only intercepts the
 * plain left click that the SPA can handle itself.
 */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (rest.target && rest.target !== '_self') return
    event.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

interface OutletContextValue {
  match: RouteMatch
}

const OutletContext = createContext<OutletContextValue | null>(null)

export function OutletProvider({ match, children }: { match: RouteMatch; children: ReactNode }) {
  const value = useMemo(() => ({ match }), [match])
  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>
}

export function useMatch(): RouteMatch {
  const context = useContext(OutletContext)
  if (!context) throw new Error('useMatch must be used inside OutletProvider')
  return context.match
}
