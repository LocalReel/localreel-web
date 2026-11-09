import { useEffect } from 'react'
import { AdminPage } from '../features/admin/AdminPage'
import { HomePage } from '../features/home/HomePage'
import { LibraryPage } from '../features/library/LibraryPage'
import { NotFound } from '../features/notfound/NotFound'
import { ReelsPage } from '../features/reels/ReelsPage'
import { ShowPage } from '../features/show/ShowPage'
import { WatchPage } from '../features/watch/WatchPage'
import { cache } from '../data/cache'
import { invalidatedBy, openEventStream } from '../data/events'
import { useRoute, useScrollRestoration, navigate } from './router'
import { Shell } from './Shell'

/**
 * Route switch.
 *
 * Two surfaces own the whole viewport (the player and the vertical feed) and
 * deliberately skip the chrome; everything else shares the shell. Nothing here
 * knows about fetching: pages do that themselves through the query cache.
 */
export default function App() {
  const route = useRoute()
  useScrollRestoration()
  useServerEvents()

  // `/watch` was the vertical feed before this release and is still in a few
  // bookmarks; keep it working instead of answering with a 404 page.
  useEffect(() => {
    if (route.name === 'notfound' && route.path === '/watch') navigate('/reels', { replace: true })
  }, [route.name, route.path])

  if (route.name === 'watch') return <WatchPage id={route.params.id} />
  if (route.name === 'reels') return <ReelsPage />

  return (
    <Shell match={route}>
      {render(route.name, route.params)}
    </Shell>
  )
}

function render(name: string, params: Record<string, string>) {
  switch (name) {
    case 'home':
      return <HomePage />
    case 'library':
      return <LibraryPage />
    case 'show':
      return <ShowPage id={params.id} />
    case 'admin.overview':
    case 'admin.sources':
    case 'admin.accounts':
    case 'admin.jobs':
    case 'admin.scans':
    case 'admin.cache':
    case 'admin.backup':
    case 'admin.plugins':
    case 'admin.plugin':
    case 'admin.settings':
      return <AdminPage section={name} pluginId={params.id} />
    default:
      return <NotFound />
  }
}

/**
 * Turn the server's event stream into cache invalidations.
 *
 * Events are hints, not state: a slow reader silently misses frames, so the tab
 * also reloads everything when it becomes visible again.
 */
function useServerEvents() {
  useEffect(() => {
    const close = openEventStream({
      onEvent: event => {
        for (const prefix of invalidatedBy(event)) cache.invalidate(prefix)
      },
      onReconnect: () => cache.invalidate(''),
    })

    const onVisible = () => {
      if (document.visibilityState === 'visible') cache.invalidate('')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
