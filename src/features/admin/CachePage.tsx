import { useState } from 'react'

import { fetchCacheStats, runCacheGc } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { CacheGcResult } from '../../data/types'
import { useT } from '../../i18n'
import { formatBytes } from '../../lib/format'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { FactList, Notice, StatTile, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * Cache is safe to empty: thumbnails and transcodes are rebuilt on demand.
 * The page therefore states the numbers plainly and offers one button, instead
 * of hiding the action behind a destructive flow it does not need.
 */
export function CachePage() {
  const t = useT()
  const stats = useQuery('cache:stats', fetchCacheStats, { staleTime: 15_000 })
  const gc = useAction()
  const [result, setResult] = useState<CacheGcResult | null>(null)

  const clean = () => {
    void gc.run('gc', () => runCacheGc()).then(next => {
      if (!next) return
      setResult(next)
      stats.reload()
    })
  }

  const data = stats.data

  return (
    <div className={styles.stack}>
      <Panel
        title={t('cache.title')}
        note={t('cache.subtitle')}
        tools={
          <Button
            variant="primary"
            icon="trash"
            loading={gc.pending === 'gc'}
            disabled={gc.pending != null}
            onClick={clean}
          >
            {gc.pending === 'gc' ? t('cache.gc.running') : t('cache.action.gc')}
          </Button>
        }
      >
        {stats.error ? <Notice error={stats.error} onDismiss={() => stats.reload()} /> : null}
        {gc.error ? <Notice error={gc.error} onDismiss={gc.reset} /> : null}

        {data ? (
          <div className={styles.stackTight}>
            <StatTile label={t('cache.total')} value={formatBytes(data.total_bytes)} />
            <FactList
              items={[
                {
                  key: 'transcodes',
                  label: t('cache.transcodes'),
                  value: t('cache.count', {
                    count: data.transcode_count,
                    size: formatBytes(data.transcode_bytes),
                  }),
                },
                {
                  key: 'thumbnails',
                  label: t('cache.thumbnails'),
                  value: t('cache.count', {
                    count: data.thumbnail_count,
                    size: formatBytes(data.thumbnail_bytes),
                  }),
                },
              ]}
            />
            {result ? (
              <p className={styles.ok}>
                {t('cache.gc.done', {
                  removed: result.removed,
                  freed: formatBytes(result.freed_bytes),
                  kept: result.kept,
                })}
              </p>
            ) : null}
            <p className={styles.hintLine}>{t('cache.gc.note')}</p>
          </div>
        ) : stats.loading ? (
          <LoadingRow>{t('common.loading')}</LoadingRow>
        ) : null}
      </Panel>
    </div>
  )
}
