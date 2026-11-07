import { useState } from 'react'
import type { Track } from './api'
import type { Translate } from './i18n'

/** `ja · 5.1 · Commentary`, with unknown parts left out. */
function trackLabel(track: Track, t: Translate): string {
  const channels =
    track.channels === 2
      ? '2.0'
      : track.channels === 6
        ? '5.1'
        : track.channels
          ? `${track.channels}ch`
          : null
  return [track.language ?? t('player.audio.unknown'), channels, track.title]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Audio track picker shared by the library player and the Reels player.
 *
 * Selecting a non-default track asks the server to re-mux, so the parent simply
 * re-runs `preparePlayback` with the new id; the hint explains why playback may
 * take a moment longer.
 */
export default function TrackMenu({
  tracks,
  selected,
  onSelect,
  t,
}: {
  tracks: Track[]
  selected: number | null
  onSelect: (track: Track) => void
  t: Translate
}) {
  const [open, setOpen] = useState(false)
  if (tracks.length === 0) return null

  const current =
    tracks.find(track => track.id === selected) ??
    tracks.find(track => track.is_default) ??
    tracks[0]

  return (
    <div className="track-menu">
      <button
        type="button"
        className={open ? 'mode active' : 'mode'}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('player.audio')}
        onClick={() => setOpen(value => !value)}
      >
        {t('player.audio')}
      </button>
      {open && (
        <div className="track-popover">
          <p className="track-title">{t('player.audio.title')}</p>
          <ul role="listbox" aria-label={t('player.audio.title')}>
            {tracks.map(track => (
              <li key={track.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={track.id === current.id}
                  className={track.id === current.id ? 'active' : undefined}
                  onClick={() => {
                    setOpen(false)
                    onSelect(track)
                  }}
                >
                  <span>{trackLabel(track, t)}</span>
                  {track.is_default && (
                    <em>{t('player.audio.default')}</em>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="track-hint">{t('player.audio.hint')}</p>
        </div>
      )}
    </div>
  )
}
