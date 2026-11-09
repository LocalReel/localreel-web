/**
 * Route table and matching.
 *
 * Deliberately framework-free: the server has no SPA fallback for arbitrary
 * paths yet, and the matching rules are the part most worth unit-testing, so
 * this module is pure and `router.tsx` only adds the React glue.
 *
 * Patterns support `:param` segments only. Anything fancier (optional
 * segments, wildcards) is not needed by this app and would be dead code.
 */

export type RouteName =
  | 'home'
  | 'library'
  | 'reels'
  | 'show'
  | 'watch'
  | 'admin.overview'
  | 'admin.sources'
  | 'admin.accounts'
  | 'admin.jobs'
  | 'admin.scans'
  | 'admin.cache'
  | 'admin.backup'
  | 'admin.plugins'
  | 'admin.plugin'
  | 'admin.settings'
  | 'notfound'

export interface RouteDefinition {
  name: RouteName
  pattern: string
}

/** Every navigable path, in the order a router should prefer them. */
export const routes: RouteDefinition[] = [
  { name: 'home', pattern: '/' },
  { name: 'library', pattern: '/library' },
  { name: 'reels', pattern: '/reels' },
  { name: 'show', pattern: '/show/:id' },
  { name: 'watch', pattern: '/watch/:id' },
  { name: 'admin.overview', pattern: '/admin' },
  { name: 'admin.sources', pattern: '/admin/sources' },
  { name: 'admin.accounts', pattern: '/admin/accounts' },
  { name: 'admin.jobs', pattern: '/admin/jobs' },
  { name: 'admin.scans', pattern: '/admin/scans' },
  { name: 'admin.cache', pattern: '/admin/cache' },
  { name: 'admin.backup', pattern: '/admin/backup' },
  { name: 'admin.plugins', pattern: '/admin/plugins' },
  { name: 'admin.plugin', pattern: '/admin/plugins/:id' },
  { name: 'admin.settings', pattern: '/admin/settings' },
]

export interface RouteMatch {
  name: RouteName
  pattern: string
  params: Record<string, string>
  /** Pathname without the query string. */
  path: string
}

interface Compiled {
  name: RouteName
  pattern: string
  segments: string[]
  paramIndexes: number[]
}

const compiled: Compiled[] = routes.map(route => {
  const segments = route.pattern.split('/').filter(Boolean)
  return {
    name: route.name,
    pattern: route.pattern,
    segments,
    paramIndexes: segments
      .map((segment, index) => (segment.startsWith(':') ? index : -1))
      .filter(index => index >= 0),
  }
})

/** Split a URL into its pathname, ignoring origin, hash and query. */
export function pathOf(url: string): string {
  const withoutOrigin = url.replace(/^[a-z]+:\/\/[^/]+/i, '')
  const cut = withoutOrigin.search(/[?#]/)
  const path = cut >= 0 ? withoutOrigin.slice(0, cut) : withoutOrigin
  if (!path) return '/'
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/** The query string of a URL, including the leading `?`, or ''. */
export function searchOf(url: string): string {
  const index = url.indexOf('?')
  if (index < 0) return ''
  const hash = url.indexOf('#', index)
  return hash >= 0 ? url.slice(index, hash) : url.slice(index)
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    // A malformed escape is not worth crashing a route match over.
    return segment
  }
}

/**
 * Match a URL (or a bare path) against the route table.
 *
 * An unknown path matches nothing and the caller renders the not-found view;
 * the app never silently falls back to the home page, because that hides
 * broken links instead of showing them.
 */
export function matchRoute(url: string): RouteMatch {
  const path = pathOf(url)
  const parts = path.split('/').filter(Boolean)

  for (const route of compiled) {
    if (route.segments.length !== parts.length) continue
    const params: Record<string, string> = {}
    let matched = true
    for (let index = 0; index < parts.length; index += 1) {
      const segment = route.segments[index]
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeSegment(parts[index])
        continue
      }
      if (segment !== decodeSegment(parts[index])) {
        matched = false
        break
      }
    }
    if (matched) return { name: route.name, pattern: route.pattern, params, path }
  }

  return { name: 'notfound', pattern: '*', params: {}, path }
}

/** Build a concrete path for a route, encoding each parameter. */
export function routeHref(name: RouteName, params: Record<string, string | number> = {}): string {
  const route = routes.find(entry => entry.name === name)
  if (!route) return '/'
  const segments = route.pattern.split('/').filter(Boolean).map(segment => {
    if (!segment.startsWith(':')) return segment
    const value = params[segment.slice(1)]
    return value == null ? '' : encodeURIComponent(String(value))
  })
  return `/${segments.join('/')}`
}

/** Whether a rendered link should be marked as the current page. */
export function isActive(match: RouteMatch, name: RouteName): boolean {
  if (match.name === name) return true
  // The plugin detail page keeps the plugins tab lit.
  if (name === 'admin.plugins' && match.name === 'admin.plugin') return true
  return false
}

/** Top-level section of a route, used to light the primary navigation. */
export function sectionOf(match: RouteMatch): 'home' | 'library' | 'reels' | 'admin' | 'none' {
  if (match.name === 'home') return 'home'
  if (match.name === 'library' || match.name === 'show') return 'library'
  if (match.name === 'reels') return 'reels'
  if (match.name === 'watch') return 'none'
  if (match.name.startsWith('admin')) return 'admin'
  return 'none'
}
