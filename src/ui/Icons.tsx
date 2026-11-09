import type { SVGProps } from 'react'

/**
 * One icon set, drawn on a 24×24 grid with a 1.6 stroke.
 *
 * Inline paths rather than an icon package: the server caps the bundle by
 * embedding it into the binary, and 30 paths cost less than a dependency.
 */
export type IconName =
  | 'home'
  | 'library'
  | 'reels'
  | 'console'
  | 'search'
  | 'user'
  | 'signout'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'close'
  | 'play'
  | 'pause'
  | 'volume'
  | 'mute'
  | 'heart'
  | 'bookmark'
  | 'expand'
  | 'collapse'
  | 'refresh'
  | 'plus'
  | 'more'
  | 'check'
  | 'alert'
  | 'info'
  | 'trash'
  | 'key'
  | 'shield'
  | 'puzzle'
  | 'server'
  | 'folder'
  | 'clock'
  | 'film'
  | 'list'
  | 'terminal'
  | 'settings'
  | 'globe'
  | 'sun'
  | 'moon'
  | 'external'
  | 'copy'
  | 'download'
  | 'upload'
  | 'database'
  | 'activity'
  | 'layers'

const paths: Record<IconName, React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1z" />,
  library: (
    <>
      <rect x="3.75" y="4.75" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.75" y="4.75" width="6.5" height="6.5" rx="1.4" />
      <rect x="3.75" y="14.75" width="6.5" height="4.5" rx="1.4" />
      <rect x="13.75" y="14.75" width="6.5" height="4.5" rx="1.4" />
    </>
  ),
  reels: (
    <>
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4" />
      <path d="M10.25 8.75 16 12l-5.75 3.25z" fill="currentColor" stroke="none" />
    </>
  ),
  console: (
    <>
      <path d="M4 7.5h7M15 7.5h5M4 16.5h5M13 16.5h7" />
      <circle cx="13" cy="7.5" r="2" />
      <circle cx="11" cy="16.5" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.25" />
      <path d="m15.6 15.6 3.65 3.65" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.3-3 3.8-4.5 7-4.5s5.7 1.5 7 4.5" />
    </>
  ),
  signout: (
    <>
      <path d="M14.5 5H7a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7.5" />
      <path d="M12 12h8m0 0-3-3m3 3-3 3" />
    </>
  ),
  'chevron-left': <path d="m14.5 6.5-5.5 5.5 5.5 5.5" />,
  'chevron-right': <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  'chevron-down': <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  volume: (
    <>
      <path d="M5 9.5h3l4.5-3.5v12L8 14.5H5z" />
      <path d="M16 9c1.2 1.7 1.2 4.3 0 6" />
    </>
  ),
  mute: (
    <>
      <path d="M5 9.5h3l4.5-3.5v12L8 14.5H5z" />
      <path d="m16 9.5 4 5m0-5-4 5" />
    </>
  ),
  heart: (
    <path d="M12 19.5S4.5 15 4.5 9.9A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7.5 2.3c0 5.1-7.5 9.6-7.5 9.6z" />
  ),
  bookmark: <path d="M6.5 4.75h11v15L12 15.6l-5.5 4.15z" />,
  expand: <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />,
  collapse: <path d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5" />,
  refresh: (
    <>
      <path d="M19 12a7 7 0 1 1-2.1-5" />
      <path d="M19 4.5V9h-4.5" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4.2M12 17.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5.2M12 7.8v.1" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9.5 7V5.5h5V7M7 7l.8 12h8.4L17 7" />
      <path d="M10.5 10.5v5M13.5 10.5v5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H20m-3 0v3m-3-3v2" />
    </>
  ),
  shield: <path d="M12 4 5.5 6.5v5.8c0 3.6 2.6 6.5 6.5 7.7 3.9-1.2 6.5-4.1 6.5-7.7V6.5z" />,
  puzzle: (
    <path d="M10 4.5h2.2a1.8 1.8 0 0 1 0 3.6H10v2.4H7.6a1.8 1.8 0 0 0 0 3.6H10v2.4h4.4v2.4h2.2v-2.4h1.9a1.5 1.5 0 0 0 1.5-1.5v-2.4h-2.4a1.8 1.8 0 0 1 0-3.6H20V6a1.5 1.5 0 0 0-1.5-1.5h-2.1V4.5z" />
  ),
  server: (
    <>
      <rect x="3.75" y="4.75" width="16.5" height="6" rx="1.5" />
      <rect x="3.75" y="13.25" width="16.5" height="6" rx="1.5" />
      <path d="M7 7.75v.5M7 16.25v.5" />
    </>
  ),
  folder: <path d="M4 6.5h5.2l1.6 2H20v10H4z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  film: (
    <>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2" />
      <path d="M8 4.75v14.5M16 4.75v14.5M3.75 12h16.5" />
    </>
  ),
  list: <path d="M8 7h12M8 12h12M8 17h12M4.5 7v.1M4.5 12v.1M4.5 17v.1" />,
  terminal: (
    <>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2" />
      <path d="m7.5 9.5 2.5 2.5-2.5 2.5M12.5 15h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.75" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.2 2.2 3.3 5 3.3 8s-1.1 5.8-3.3 8c-2.2-2.2-3.3-5-3.3-8S9.8 6.2 12 4z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  external: <path d="M13.5 5.5H19v5.5M19 5.5 11 13.5M17 14v5.5H5V7.5h5" />,
  copy: (
    <>
      <rect x="8.75" y="8.75" width="10.5" height="10.5" rx="1.6" />
      <path d="M15.25 5.75h-10a1.5 1.5 0 0 0-1.5 1.5v10" />
    </>
  ),
  download: <path d="M12 4.5v11m0 0 4-4m-4 4-4-4M5 18.5h14" />,
  upload: <path d="M12 19.5v-11m0 0 4 4m-4-4-4 4M5 5.5h14" />,
  database: (
    <>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="2.75" />
      <path d="M4.5 6.5v11c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75v-11M4.5 12c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75" />
    </>
  ),
  activity: <path d="M3.5 12.5h4l2.5-7 4 13 2.5-6h4" />,
  layers: <path d="m12 4 8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />,
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number | string
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
