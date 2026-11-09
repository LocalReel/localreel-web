import { useRoute } from '../../app/router'
import { AdminTabs } from '../../app/Shell'
import { useT } from '../../i18n'
import { Empty } from '../../ui/Empty'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { useAuth } from '../auth/context'
import { AccountsPage } from './AccountsPage'
import { AuditPage } from './AuditPage'
import { BackupPage } from './BackupPage'
import { CachePage } from './CachePage'
import { JobsPage } from './JobsPage'
import { OverviewPage } from './OverviewPage'
import { ScansPage } from './ScansPage'
import { SettingsPage } from './SettingsPage'
import { SourcesPage } from './SourcesPage'

/**
 * The console router.
 *
 * `section` is the route name the shell matched; the shell keeps rendering the
 * same page component while the console switches tabs, so each page is one
 * block of state rather than a long-lived app of its own.
 */
export function AdminPage({ section }: { section: string }) {
  const t = useT()
  const route = useRoute()
  const { user } = useAuth()

  // The server refuses these endpoints to viewers; the UI must not show
  // controls that would only ever return 403.
  if (user.role !== 'admin') {
    return (
      <Panel title={t('admin.adminOnly')}>
        <Empty title={t('admin.viewerNotice')} />
      </Panel>
    )
  }

  return (
    <>
      <PageHeader
        kicker={t('home.kicker')}
        title={t('admin.title')}
        note={t('admin.subtitle')}
      />
      <AdminTabs match={route} />
      {sectionView(section)}
    </>
  )
}

function sectionView(section: string) {
  switch (section) {
    case 'admin.sources':
      return <SourcesPage />
    case 'admin.accounts':
      return <AccountsPage />
    case 'admin.jobs':
      return <JobsPage />
    case 'admin.scans':
      return <ScansPage />
    case 'admin.cache':
      return <CachePage />
    case 'admin.backup':
      return <BackupPage />
    case 'admin.audit':
      return <AuditPage />
    case 'admin.settings':
      return <SettingsPage />
    default:
      return <OverviewPage />
  }
}
