import type { IconName } from '../ui/Icons'
import type { TranslationKey } from '../i18n/dict.en'
import type { RouteName } from './match'

export interface NavItem {
  to: string
  route: RouteName
  labelKey: TranslationKey
  icon: IconName
  /** Only administrators see this destination. */
  adminOnly?: boolean
}

export const primaryNav: NavItem[] = [
  { to: '/', route: 'home', labelKey: 'nav.home', icon: 'home' },
  { to: '/library', route: 'library', labelKey: 'nav.library', icon: 'library' },
  { to: '/reels', route: 'reels', labelKey: 'nav.reels', icon: 'reels' },
  // The plugin module is its own destination from here on, not a console tab.
  // It stays administrator-only until it has a viewer-facing surface; showing
  // an entry that always answers 403 would be worse than hiding it.
  { to: '/plugins', route: 'plugins', labelKey: 'nav.plugins', icon: 'puzzle', adminOnly: true },
  { to: '/admin', route: 'admin.overview', labelKey: 'nav.admin', icon: 'console', adminOnly: true },
]

export interface AdminTab {
  to: string
  route: RouteName
  labelKey: TranslationKey
  icon: IconName
}

export const adminTabs: AdminTab[] = [
  { to: '/admin', route: 'admin.overview', labelKey: 'admin.tab.overview', icon: 'activity' },
  { to: '/admin/sources', route: 'admin.sources', labelKey: 'admin.tab.sources', icon: 'folder' },
  { to: '/admin/accounts', route: 'admin.accounts', labelKey: 'admin.tab.accounts', icon: 'user' },
  { to: '/admin/jobs', route: 'admin.jobs', labelKey: 'admin.tab.jobs', icon: 'clock' },
  { to: '/admin/scans', route: 'admin.scans', labelKey: 'admin.tab.scans', icon: 'list' },
  { to: '/admin/cache', route: 'admin.cache', labelKey: 'admin.tab.cache', icon: 'database' },
  { to: '/admin/backup', route: 'admin.backup', labelKey: 'admin.tab.backup', icon: 'layers' },
  { to: '/admin/settings', route: 'admin.settings', labelKey: 'admin.tab.settings', icon: 'settings' },
]
