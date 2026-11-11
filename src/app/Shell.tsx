import { useState, type FormEvent, type ReactNode } from 'react'

import { adminTabs, primaryNav, type NavItem } from './nav'
import { navigate, Link } from './router'
import { isActive, sectionOf, type RouteMatch } from './match'
import { useSettings } from './settings'
import { useAuth } from '../features/auth/context'
import { useT } from '../i18n'
import { Icon } from '../ui/Icons'
import { Menu, MenuItem, MenuLabel } from '../ui/Menu'
import styles from './Shell.module.css'

/** The chrome every non-immersive page shares. */
export function Shell({ match, children }: { match: RouteMatch; children: ReactNode }) {
  const t = useT()
  return (
    <div className={styles.app}>
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <Sidebar match={match} />
      <div className={styles.main}>
        <Topbar match={match} />
        <main id="main" className={styles.content} tabIndex={-1}>
          {children}
        </main>
      </div>
      <BottomNav match={match} />
    </div>
  )
}

function visibleNav(admin: boolean): NavItem[] {
  return primaryNav.filter(item => !item.adminOnly || admin)
}

function Sidebar({ match }: { match: RouteMatch }) {
  const t = useT()
  const { user } = useAuth()
  const admin = user.role === 'admin'
  const section = sectionOf(match)
  const items = visibleNav(admin)

  return (
    <aside className={styles.rail} aria-label={t('nav.primary')}>
      <Link to="/" className={styles.brand} aria-label="LocalReel">
        <span className={styles.brandKicker}>{t('home.kicker')}</span>
        <span className={styles.brandWord}>LocalReel</span>
        {/* Shown instead of the wordmark when the rail collapses to icons. */}
        <span className={styles.brandMark} aria-hidden="true">
          LR
        </span>
      </Link>

      <nav className={styles.nav}>
        {items.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={styles.navItem}
            aria-current={section === item.route.split('.')[0] || isActive(match, item.route) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={18} />
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.railFoot}>
        <AccountMenu />
      </div>
    </aside>
  )
}

function Topbar({ match }: { match: RouteMatch }) {
  const t = useT()
  const { settings, update } = useSettings()
  const [query, setQuery] = useState('')
  const showSearch = match.name !== 'library'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    navigate(trimmed ? `/library?q=${encodeURIComponent(trimmed)}` : '/library')
  }

  return (
    <header className={styles.topbar}>
      <Link to="/" className={styles.mobileBrand} aria-label="LocalReel">
        LocalReel
      </Link>

      {showSearch ? (
        <form className={styles.search} role="search" onSubmit={submit}>
          <Icon name="search" size={16} />
          <input
            id="global-search"
            name="q"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
          />
        </form>
      ) : null}

      <div className={styles.topActions}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => update({ lang: settings.lang === 'zh' ? 'en' : 'zh' })}
          aria-label={t('nav.language')}
          title={settings.lang === 'zh' ? 'English' : '中文'}
        >
          <Icon name="globe" size={18} />
        </button>
        <div className={styles.mobileAccount}>
          <AccountMenu compact />
        </div>
      </div>
    </header>
  )
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const { user, signOut } = useAuth()
  const { settings, update } = useSettings()
  const initial = user.username.slice(0, 1)

  return (
    <Menu
      label={t('nav.account')}
      align="right"
      trigger={
        compact ? (
          <span className={styles.avatar}>{initial}</span>
        ) : (
          <>
            <span className={styles.avatar}>{initial}</span>
            <span className={styles.accountText}>
              <span className={styles.accountName}>{user.username}</span>
              <span className={styles.accountRole}>
                {t(user.role === 'admin' ? 'auth.role.admin' : 'auth.role.user')}
              </span>
            </span>
          </>
        )
      }
      className={compact ? styles.iconButton : styles.accountButton}
    >
      <MenuLabel>{t('auth.signedInAs', { name: user.username })}</MenuLabel>
      <MenuItem
        icon="globe"
        onClick={() => update({ lang: settings.lang === 'zh' ? 'en' : 'zh' })}
      >
        {settings.lang === 'zh' ? 'English' : '中文'}
      </MenuItem>
      {user.role === 'admin' ? (
        <MenuItem icon="settings" onClick={() => navigate('/admin/settings')}>
          {t('settings.title')}
        </MenuItem>
      ) : null}
      <MenuItem icon="signout" onClick={() => void signOut()}>
        {t('nav.signOut')}
      </MenuItem>
    </Menu>
  )
}

function BottomNav({ match }: { match: RouteMatch }) {
  const t = useT()
  const { user } = useAuth()
  const admin = user.role === 'admin'
  const section = sectionOf(match)
  const items = visibleNav(admin)

  return (
    <nav className={styles.bottomNav} aria-label={t('nav.primary')}>
      {items.map(item => {
        const key = item.route.split('.')[0]
        const active = section === key || isActive(match, item.route)
        return (
          <Link
            key={item.to}
            to={item.to}
            className={styles.bottomItem}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={item.icon} size={20} />
            <span>{t(item.labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/** The sub-navigation inside the console. */
export function AdminTabs({ match }: { match: RouteMatch }) {
  const t = useT()
  return (
    <nav className={styles.adminTabs} aria-label={t('nav.section')}>
      {adminTabs.map(tab => (
        <Link
          key={tab.to}
          to={tab.to}
          className={`${styles.navItem} ${styles.adminTab}`}
          aria-current={isActive(match, tab.route) ? 'page' : undefined}
        >
          <Icon name={tab.icon} size={16} />
          <span>{t(tab.labelKey)}</span>
        </Link>
      ))}
    </nav>
  )
}
