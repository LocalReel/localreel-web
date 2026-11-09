import { Link } from '../../app/router'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'

export function NotFound() {
  const t = useT()
  return (
    <Empty
      title={t('notfound.title')}
      body={t('notfound.body')}
      action={
        <Link to="/library">
          <Button variant="primary" icon="library">
            {t('notfound.action')}
          </Button>
        </Link>
      }
    />
  )
}
