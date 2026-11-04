import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react'
import LangSwitch from './LangSwitch'
import {
  fetchFeed,
  preparePlayback,
  saveState,
  type FeedItem,
  type Media,
  type Playback,
} from './api'
import {
  feedDisplayTitle,
  feedItemFromMedia,
  formatClock,
  indexOfId,
  mergeFeedItems,
  objectFitForFeedItem,
  objectFitForVideo,
  preloadIndexes,
  progressRatio,
  swipeDirection,
  type ObjectFit,
  type SwipeDirection,
} from './feed'
import { useLang, type Translate } from './i18n'
import { resumeTarget } from './resume'

/** How many feed items the first screen requests. */
const FEED_LIMIT = 100
/** Wider re-fetch used to resolve a `next_id` that is not loaded yet. */
const FEED_LOOKUP_LIMIT = 200
/** Slides kept warm ahead of the active one (requirement: preload next 2). */
const PRELOAD_AHEAD = 2
const SAVE_INTERVAL_MS = 5000
const POLL_INTERVAL_MS = 1500
const LONG_PRESS_MS = 500
const DOUBLE_TAP_MS = 300
const TAP_DELAY_MS = 260
const SWIPE_THRESHOLD_PX = 56
const TAP_SLOP_PX = 10

/**
 * Final progress write that must survive page unload. `saveState()` is a normal
 * JSON request, so pause/visibility/pagehide/unmount/switching use this raw
 * `fetch(..., { keepalive: true })` instead. Progress is best-effort: failures
 * never block playback.
 */
function flushState(id: number, position: number, duration: number): void {
  if (!Number.isFinite(position) || position <= 0) return
  const payload = JSON.stringify({
    position,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
  })
  try {
    void fetch(`/api/v1/media/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Best effort.
    })
  } catch {
    // Older browsers without keepalive support: drop the final sample.
  }
}

/** Last-resort lookup for a `next_id` outside the loaded feed. */
async function fetchMediaById(id: number): Promise<Media | null> {
  try {
    const response = await fetch(`/api/v1/media/${id}`)
    if (!response.ok) return null
    return (await response.json()) as Media
  } catch {
    return null
  }
}

function mediaDuration(element: HTMLVideoElement, fallback: number): number {
  if (Number.isFinite(element.duration) && element.duration > 0) return element.duration
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0
}

export default function Reels() {
  const { lang, setLang, t } = useLang()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [playback, setPlayback] = useState<Record<number, Playback>>({})
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)

  const scroller = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<FeedItem[]>([])
  const playbackRef = useRef<Record<number, Playback>>({})
  const wantedRef = useRef<Set<number>>(new Set())
  const inFlightRef = useRef<Set<number>>(new Set())
  const aliveRef = useRef(true)
  const pendingIndexRef = useRef<number | null>(null)
  const failedAdvanceRef = useRef<FeedItem | null>(null)

  const applyItems = useCallback((next: FeedItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchFeed(FEED_LIMIT)
      if (!aliveRef.current) return
      applyItems(page.items)
    } catch (cause) {
      if (!aliveRef.current) return
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }, [applyItems])

  useEffect(() => {
    aliveRef.current = true
    document.body.classList.add('reels-open')
    void loadFeed()
    return () => {
      aliveRef.current = false
      document.body.classList.remove('reels-open')
    }
  }, [loadFeed])

  /**
   * Resolve a playback URL for one media id. `preparing` is polled by the
   * interval below; `failed` is left for the slide's retry button.
   */
  const ensurePlayback = useCallback((id: number, force = false) => {
    if (!aliveRef.current) return
    const current = playbackRef.current[id]
    if (!force && current && current.mode !== 'preparing') return
    if (inFlightRef.current.has(id)) return
    inFlightRef.current.add(id)
    preparePlayback(id)
      .then(next => {
        if (!aliveRef.current) return
        playbackRef.current = { ...playbackRef.current, [id]: next }
        setPlayback(playbackRef.current)
      })
      .catch((cause: unknown) => {
        if (!aliveRef.current) return
        const message = cause instanceof Error ? cause.message : String(cause)
        const failed: Playback = { mode: 'failed', message }
        playbackRef.current = { ...playbackRef.current, [id]: failed }
        setPlayback(playbackRef.current)
      })
      .finally(() => {
        inFlightRef.current.delete(id)
      })
  }, [])

  // Warm the active slide and the next two so a swipe never waits on prepare.
  useEffect(() => {
    const indexes = preloadIndexes(items.length, active, PRELOAD_AHEAD)
    wantedRef.current = new Set(indexes.map(index => items[index].id))
    for (const index of indexes) ensurePlayback(items[index].id)
  }, [active, ensurePlayback, items])

  // While a transcode is running the backend answers `preparing`; poll it.
  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const id of wantedRef.current) {
        const current = playbackRef.current[id]
        if (!current || current.mode === 'preparing') ensurePlayback(id)
      }
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [ensurePlayback])

  const retryPlayback = useCallback(
    (id: number) => {
      const next = { ...playbackRef.current }
      delete next[id]
      playbackRef.current = next
      setPlayback(next)
      ensurePlayback(id, true)
    },
    [ensurePlayback],
  )

  const goTo = useCallback((index: number) => {
    const element = scroller.current
    const count = itemsRef.current.length
    if (!element || count === 0) return
    const clamped = Math.max(0, Math.min(count - 1, index))
    setActive(clamped)
    element.scrollTo({ top: clamped * element.clientHeight, behavior: 'smooth' })
  }, [])

  const step = useCallback(
    (direction: SwipeDirection) => {
      const element = scroller.current
      if (!element || element.clientHeight === 0) return
      const current = Math.round(element.scrollTop / element.clientHeight)
      goTo(direction === 'next' ? current + 1 : current - 1)
    },
    [goTo],
  )

  const onScroll = useCallback(() => {
    const element = scroller.current
    if (!element || element.clientHeight === 0) return
    const index = Math.round(element.scrollTop / element.clientHeight)
    const clamped = Math.max(0, Math.min(itemsRef.current.length - 1, index))
    setActive(previous => (previous === clamped ? previous : clamped))
  }, [])

  // The appended slide only exists after React commits the new items.
  useEffect(() => {
    const pending = pendingIndexRef.current
    if (pending == null) return
    pendingIndexRef.current = null
    goTo(pending)
  }, [goTo, items])

  // A stale autoplay error should not follow the user to another slide.
  useEffect(() => {
    setAdvanceError(null)
    failedAdvanceRef.current = null
  }, [active])

  /**
   * Autoplay: when a slide ends and the server says there is a next episode,
   * resolve it (from the loaded feed, a wider feed page, or the single-media
   * endpoint) and scroll there. No `next_id` means the series is finished and
   * the slide shows a completion card instead of looping.
   */
  const advance = useCallback(
    async (item: FeedItem) => {
      const nextId = item.next_id
      if (nextId == null) return
      const loaded = indexOfId(itemsRef.current, nextId)
      if (loaded >= 0) {
        goTo(loaded)
        return
      }
      setAdvancing(true)
      setAdvanceError(null)
      failedAdvanceRef.current = null
      try {
        const page = await fetchFeed(FEED_LOOKUP_LIMIT)
        if (!aliveRef.current) return
        let merged = mergeFeedItems(itemsRef.current, page.items)
        let index = indexOfId(merged, nextId)
        if (index < 0) {
          const media = await fetchMediaById(nextId)
          if (!aliveRef.current) return
          if (media) {
            merged = mergeFeedItems(merged, [feedItemFromMedia(media)])
            index = indexOfId(merged, nextId)
          }
        }
        if (index < 0) {
          failedAdvanceRef.current = item
          setAdvanceError(t('reels.nextFailed'))
          return
        }
        applyItems(merged)
        pendingIndexRef.current = index
      } catch (cause) {
        if (!aliveRef.current) return
        failedAdvanceRef.current = item
        setAdvanceError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (aliveRef.current) setAdvancing(false)
      }
    },
    [applyItems, goTo, t],
  )

  const retryAdvance = useCallback(() => {
    const target = failedAdvanceRef.current
    setAdvanceError(null)
    if (target) void advance(target)
  }, [advance])

  // Keyboard parity for the desktop preview: arrows move through the feed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const target = event.target as HTMLElement | null
      if (target && target.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      step(event.key === 'ArrowDown' ? 'next' : 'prev')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

  const current = items[active]

  return (
    <div
      className="reels"
      ref={scroller}
      onScroll={onScroll}
      aria-label={t('nav.reels')}
    >
      <div className="reels-top">
        <a className="reels-back" href="/">
          {t('nav.library.back')}
        </a>
        <LangSwitch lang={lang} onChange={setLang} t={t} variant="dark" />
      </div>

      {loading && <div className="reels-empty">{t('reels.loading')}</div>}
      {!loading && error && (
        <div className="reels-empty error">
          <p>{error}</p>
          <button type="button" className="reel-button" onClick={() => void loadFeed()}>
            {t('reels.retry')}
          </button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="reels-empty">{t('reels.empty')}</div>
      )}

      {items.map((item, index) => (
        <ReelSlide
          key={item.id}
          item={item}
          active={index === active}
          playback={playback[item.id]}
          muted={muted}
          t={t}
          onAdvance={advance}
          onRetry={retryPlayback}
          onStep={step}
          onToggleMuted={() => setMuted(value => !value)}
        />
      ))}

      {(advancing || advanceError) && (
        <div className="reels-toast" role="status">
          <span>{advancing ? t('reels.loadingNext') : advanceError}</span>
          {!advancing && advanceError && current && (
            <button type="button" className="reels-toast-button" onClick={retryAdvance}>
              {t('reels.retry')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface ReelSlideProps {
  item: FeedItem
  active: boolean
  playback: Playback | undefined
  muted: boolean
  t: Translate
  onAdvance: (item: FeedItem) => void
  onRetry: (id: number) => void
  onStep: (direction: SwipeDirection) => void
  onToggleMuted: () => void
}

interface GestureState {
  pointerId: number
  startX: number
  startY: number
  /** Scroll offset when the gesture started, used to detect a native pan. */
  scrollTop: number
  moved: boolean
  longPressed: boolean
}

interface ScrubState {
  pointerId: number
  startX: number
  startY: number
  mode: 'pending' | 'seek' | 'vertical'
}

function ReelSlide({
  item,
  active,
  playback,
  muted,
  t,
  onAdvance,
  onRetry,
  onStep,
  onToggleMuted,
}: ReelSlideProps) {
  const video = useRef<HTMLVideoElement | null>(null)
  const [liked, setLiked] = useState(item.liked)
  const [favorite, setFavorite] = useState(item.favorite)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(item.duration)
  const [paused, setPaused] = useState(true)
  const [ended, setEnded] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [fit, setFit] = useState<ObjectFit>(() => objectFitForFeedItem(item))
  const [burst, setBurst] = useState(0)
  const [longPressing, setLongPressing] = useState(false)
  const [scrubRatio, setScrubRatio] = useState<number | null>(null)

  const lastSave = useRef(0)
  const resumePending = useRef(true)
  const resumeApplied = useRef(false)
  const resumeAt = useRef<number | null>(resumeTarget(item.position, item.duration))
  const gesture = useRef<GestureState | null>(null)
  const longTimer = useRef<number | null>(null)
  const tapTimer = useRef<number | null>(null)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)
  const scrub = useRef<ScrubState | null>(null)
  const track = useRef<HTMLDivElement | null>(null)

  const url =
    playback?.mode === 'direct' || playback?.mode === 'ready' ? playback.url : undefined
  const failed = playback?.mode === 'failed' || videoFailed
  const preparing = playback?.mode === 'preparing'
  const seen = resumeTarget(item.position, item.duration)
  const title = feedDisplayTitle(item)
  const seriesTitle = item.series_title?.trim() ?? ''
  const heading = seriesTitle || title
  const subtitle =
    item.episode != null
      ? t('reels.episode', { episode: item.episode })
      : heading === title
        ? ''
        : title

  /** Normal progress saves go through the shared API helper. */
  const save = useCallback(
    (position: number, seconds: number, keepalive = false) => {
      if (resumePending.current) return
      if (!Number.isFinite(position) || position <= 0) return
      const durationValue = Number.isFinite(seconds) && seconds > 0 ? seconds : item.duration
      if (keepalive) {
        flushState(item.id, position, durationValue)
        return
      }
      void saveState(item.id, { position, duration: durationValue }).catch(() => {
        // Progress is best-effort; playback must not block on it.
      })
    },
    [item.duration, item.id],
  )

  // Play only the active slide, pause everything else.
  useEffect(() => {
    const element = video.current
    if (!element || !url) return
    if (!active) {
      element.pause()
      return
    }
    setEnded(false)
    const total = mediaDuration(element, item.duration)
    if (element.ended || (total > 0 && element.currentTime >= total - 0.3)) {
      try {
        element.currentTime = 0
      } catch {
        // Seeking can fail before metadata; the next play attempt recovers.
      }
    }
    void element.play().catch(() => {
      setPaused(true)
    })
    return () => {
      element.pause()
    }
  }, [active, item.duration, url])

  // Mute is shared by the whole feed.
  useEffect(() => {
    const element = video.current
    if (element) element.muted = muted
  }, [muted, url])

  // A new source starts a fresh resume/seek cycle.
  useEffect(() => {
    setVideoFailed(false)
    setEnded(false)
    resumeApplied.current = false
    resumePending.current = true
    resumeAt.current = resumeTarget(item.position, item.duration)
  }, [item.duration, item.id, item.position, url])

  // Flush the last known position when the slide stops being active, when the
  // app is hidden/closed, and when the component unmounts.
  useEffect(() => {
    if (!active) return
    const flush = () => {
      const element = video.current
      if (element) save(element.currentTime, element.duration, true)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [active, save])

  // Timers must not outlive the slide.
  useEffect(() => {
    return () => {
      if (longTimer.current != null) window.clearTimeout(longTimer.current)
      if (tapTimer.current != null) window.clearTimeout(tapTimer.current)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const element = video.current
    if (!element) return
    if (element.paused) {
      setEnded(false)
      void element.play().catch(() => {
        setPaused(true)
      })
    } else {
      element.pause()
    }
  }, [])

  const toggleLike = useCallback(() => {
    const next = !liked
    setLiked(next)
    setBurst(value => value + 1)
    void saveState(item.id, { liked: next }).catch(() => {
      setLiked(next ? false : true)
    })
  }, [item.id, liked])

  const toggleFavorite = useCallback(() => {
    const next = !favorite
    setFavorite(next)
    void saveState(item.id, { favorite: next }).catch(() => {
      setFavorite(next ? false : true)
    })
  }, [favorite, item.id])

  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget
    setFit(objectFitForVideo(element.videoWidth, element.videoHeight))
    const total = mediaDuration(element, item.duration)
    setDuration(total)
    const target = resumeAt.current
    if (!resumeApplied.current && target != null) {
      const safe = resumeTarget(target, total)
      if (safe != null) {
        try {
          element.currentTime = safe
        } catch {
          // Ignore: playing from 0 is an acceptable fallback.
        }
      }
      resumeApplied.current = true
    }
    resumePending.current = false
  }

  const handleDurationChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    const total = mediaDuration(event.currentTarget, item.duration)
    if (total > 0) setDuration(total)
  }

  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget
    setCurrentTime(element.currentTime)
    const now = Date.now()
    if (now - lastSave.current < SAVE_INTERVAL_MS) return
    lastSave.current = now
    save(element.currentTime, element.duration)
  }

  const handlePause = (event: SyntheticEvent<HTMLVideoElement>) => {
    setPaused(true)
    save(event.currentTarget.currentTime, event.currentTarget.duration, true)
  }

  const handleEnded = (event: SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget
    setCurrentTime(element.duration || item.duration)
    // Saving position == duration lets the server rank this item as finished.
    save(element.currentTime, element.duration, true)
    if (item.next_id != null) {
      onAdvance(item)
    } else {
      setEnded(true)
    }
  }

  const handleRetry = () => {
    setVideoFailed(false)
    onRetry(item.id)
    const element = video.current
    if (element) element.load()
  }

  const replay = () => {
    const element = video.current
    setEnded(false)
    if (!element) return
    try {
      element.currentTime = 0
    } catch {
      // Ignore.
    }
    void element.play().catch(() => {
      setPaused(true)
    })
  }

  // --- gestures (video area only) -------------------------------------------

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button, a, input, [data-gesture="ignore"]')) return
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollTop: (event.currentTarget.closest('.reels') as HTMLElement | null)?.scrollTop ?? 0,
      moved: false,
      longPressed: false,
    }
    // Pointer capture keeps mouse drags alive outside the stage; touch keeps
    // native vertical scrolling because we never capture touch pointers.
    if (event.pointerType !== 'touch') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore: capture is an enhancement, not a requirement.
      }
    }
    if (longTimer.current != null) window.clearTimeout(longTimer.current)
    longTimer.current = window.setTimeout(() => {
      const state = gesture.current
      if (!state || state.moved) return
      const element = video.current
      if (!element) return
      state.longPressed = true
      setLongPressing(true)
      element.playbackRate = 2
      if (element.paused) {
        void element.play().catch(() => {
          // Ignore: the speed indicator still shows.
        })
      }
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gesture.current
    if (!state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (state.moved) return
    if (Math.hypot(dx, dy) <= TAP_SLOP_PX) return
    state.moved = true
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
    // A pending single-tap pause must not fire after a swipe started.
    if (tapTimer.current != null) {
      window.clearTimeout(tapTimer.current)
      tapTimer.current = null
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = gesture.current
    if (!state || state.pointerId !== event.pointerId) return
    gesture.current = null
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
    if (state.longPressed) {
      const element = video.current
      if (element) element.playbackRate = 1
      setLongPressing(false)
      return
    }
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (state.moved) {
      const direction = swipeDirection(dx, dy, SWIPE_THRESHOLD_PX)
      if (direction) {
        // Touch swipes normally scroll the snap container natively; only jump
        // programmatically when the container did not move (some browsers do
        // not start a pan for a slow drag, and mouse drags never scroll).
        const scroller = event.currentTarget.closest('.reels') as HTMLElement | null
        const scrolledNatively = scroller
          ? Math.abs(scroller.scrollTop - state.scrollTop) > 8
          : false
        if (!scrolledNatively) onStep(direction)
      }
      return
    }
    const now = performance.now()
    const previous = lastTap.current
    if (
      previous &&
      now - previous.time < DOUBLE_TAP_MS &&
      Math.abs(event.clientX - previous.x) < 40 &&
      Math.abs(event.clientY - previous.y) < 40
    ) {
      lastTap.current = null
      if (tapTimer.current != null) {
        window.clearTimeout(tapTimer.current)
        tapTimer.current = null
      }
      toggleLike()
      return
    }
    lastTap.current = { time: now, x: event.clientX, y: event.clientY }
    if (tapTimer.current != null) window.clearTimeout(tapTimer.current)
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null
      togglePlay()
    }, TAP_DELAY_MS)
  }

  const handlePointerCancel = () => {
    const state = gesture.current
    gesture.current = null
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
    if (state?.longPressed) {
      const element = video.current
      if (element) element.playbackRate = 1
      setLongPressing(false)
    }
  }

  // --- progress bar ----------------------------------------------------------

  const ratio = scrubRatio ?? progressRatio(currentTime, duration)
  const shownTime = scrubRatio != null ? scrubRatio * duration : currentTime

  const ratioAt = (clientX: number): number => {
    const element = track.current
    if (!element) return 0
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  const seekTo = (seconds: number) => {
    const element = video.current
    const total = element ? mediaDuration(element, duration) : duration
    if (!Number.isFinite(seconds) || total <= 0) return
    const target = Math.max(0, Math.min(seconds, total - 0.05))
    if (element) {
      try {
        element.currentTime = target
      } catch {
        // Ignore: the next seek attempt recovers.
      }
    }
    setCurrentTime(target)
    setEnded(false)
  }

  const handleSeekDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    scrub.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: 'pending',
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ignore.
    }
  }

  const handleSeekMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = scrub.current
    if (!state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    // Decide the axis first so a vertical swipe over the bar still navigates.
    if (state.mode === 'pending') {
      if (Math.abs(dx) >= 6 && Math.abs(dx) >= Math.abs(dy)) state.mode = 'seek'
      else if (Math.abs(dy) >= 8 && Math.abs(dy) > Math.abs(dx)) state.mode = 'vertical'
    }
    if (state.mode !== 'seek') return
    const next = ratioAt(event.clientX)
    setScrubRatio(next)
    seekTo(next * duration)
  }

  const handleSeekUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = scrub.current
    if (!state || state.pointerId !== event.pointerId) return
    scrub.current = null
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (state.mode === 'seek') {
      const next = ratioAt(event.clientX)
      setScrubRatio(null)
      seekTo(next * duration)
      save(next * duration, duration, true)
      return
    }
    if (state.mode === 'pending') {
      const next = ratioAt(event.clientX)
      seekTo(next * duration)
      return
    }
    const direction = swipeDirection(dx, dy, SWIPE_THRESHOLD_PX)
    if (direction) onStep(direction)
  }

  const handleSeekCancel = () => {
    scrub.current = null
    setScrubRatio(null)
  }

  return (
    <section className={`reel${active ? ' active' : ''}`} aria-label={heading}>
      <div
        className="reel-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={event => event.preventDefault()}
      >
        {url && (
          <video
            ref={video}
            className={`reel-video reel-video-${fit}`}
            src={url}
            playsInline
            muted={muted}
            preload={active ? 'auto' : 'metadata'}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleDurationChange}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setPaused(false)}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={() => setVideoFailed(true)}
          />
        )}

        {!url && !failed && (
          <div className="reel-status">
            <span className="reel-spinner" aria-hidden="true" />
            <p>{preparing ? t('reels.transcoding') : t('player.preparing')}</p>
          </div>
        )}

        {active && paused && !ended && !failed && url && (
          <div className="reel-paused" aria-hidden="true">
            <PlayIcon />
          </div>
        )}

        {longPressing && (
          <div className="reel-speed" aria-hidden="true">
            2×
          </div>
        )}

        {burst > 0 && (
          <span key={burst} className="reel-burst" aria-hidden="true">
            <HeartIcon filled />
          </span>
        )}

        {ended && (
          <div className="reel-ended" role="status">
            <p>{t('reels.seriesFinished')}</p>
            <button type="button" className="reel-button" onClick={replay}>
              {t('reels.replay')}
            </button>
          </div>
        )}

        {failed && (
          <div className="reel-error" role="alert">
            <h3>{t('reels.error.title')}</h3>
            <p>{t('reels.error.body')}</p>
            <button type="button" className="reel-button" onClick={handleRetry}>
              {t('reels.retry')}
            </button>
          </div>
        )}
      </div>

      <div className="reel-overlay">
        <div className="reel-info">
          <h2 className="reel-series">{heading}</h2>
          {subtitle && <p className="reel-episode">{subtitle}</p>}
          <p className="reel-meta">
            <span>{formatClock(duration)}</span>
            {seen != null && <span>· {t('reels.seen', { time: formatClock(seen) })}</span>}
          </p>
        </div>

        <div className="reel-action-rail">
          <button
            type="button"
            className={liked ? 'reel-action active' : 'reel-action'}
            aria-pressed={liked}
            aria-label={liked ? t('reels.liked') : t('reels.like')}
            onClick={toggleLike}
          >
            <HeartIcon filled={liked} />
            <span>{liked ? t('reels.liked') : t('reels.like')}</span>
          </button>
          <button
            type="button"
            className={favorite ? 'reel-action active' : 'reel-action'}
            aria-pressed={favorite}
            aria-label={favorite ? t('reels.favorited') : t('reels.favorite')}
            onClick={toggleFavorite}
          >
            <BookmarkIcon filled={favorite} />
            <span>{favorite ? t('reels.favorited') : t('reels.favorite')}</span>
          </button>
          <button
            type="button"
            className="reel-action"
            aria-label={muted ? t('reels.unmute') : t('reels.mute')}
            onClick={onToggleMuted}
          >
            <VolumeIcon muted={muted} />
            <span>{muted ? t('reels.unmute') : t('reels.mute')}</span>
          </button>
        </div>
      </div>

      <div
        className={scrubRatio != null ? 'reel-progress scrubbing' : 'reel-progress'}
        onPointerDown={handleSeekDown}
        onPointerMove={handleSeekMove}
        onPointerUp={handleSeekUp}
        onPointerCancel={handleSeekCancel}
      >
        <span className="reel-progress-time">
          {formatClock(shownTime)} / {formatClock(duration)}
        </span>
        <div
          className="reel-progress-track"
          ref={track}
          role="slider"
          aria-label={t('reels.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          tabIndex={-1}
        >
          <div className="reel-progress-fill" style={{ width: `${ratio * 100}%` }} />
          <div className="reel-progress-thumb" style={{ left: `${ratio * 100}%` }} />
        </div>
      </div>
    </section>
  )
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 20.4 4.9 13.3a4.7 4.7 0 0 1 0-6.7 4.9 4.9 0 0 1 6.9 0l.2.2.2-.2a4.9 4.9 0 0 1 6.9 0 4.7 4.7 0 0 1 0 6.7Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.7L6 20V5.5a1 1 0 0 1 1-1Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3Z" fill="currentColor" />
      {muted ? (
        <path
          d="m16 9 5 6M21 9l-5 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16.2 9.2a4 4 0 0 1 0 5.6M18.6 6.9a7.2 7.2 0 0 1 0 10.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5Z" fill="currentColor" />
    </svg>
  )
}
