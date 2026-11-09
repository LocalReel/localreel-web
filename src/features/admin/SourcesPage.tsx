import { useState, type FormEvent } from 'react'

import { useSettings } from '../../app/settings'
import {
  addSource,
  deleteSource,
  fetchMedia,
  fetchSources,
  patchSource,
  remapSource,
  scanSource,
} from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { DeleteSourceReport, RemapReport, Source } from '../../data/types'
import { useT } from '../../i18n'
import { formatNumber } from '../../lib/format'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { useConfirm, useToast } from '../../ui/Feedback'
import { SelectField, TextField } from '../../ui/Field'
import { Panel } from '../../ui/Panel'
import { Notice, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * Sources are folders, not files: one row is a root the scanner walks, and the
 * actions mirror the lifecycle (scan, pause, archive, move, remove) so an
 * operator never has to guess what a verb will touch.
 */
export function SourcesPage() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const add = useAction()
  const row = useAction()
  const remap = useAction()

  const [uri, setUri] = useState('')
  const [kind, setKind] = useState('')
  const [remapFor, setRemapFor] = useState<Source | null>(null)
  const [remapUri, setRemapUri] = useState('')
  const [report, setReport] = useState<RemapReport | null>(null)

  const sources = useQuery('sources:all', () => fetchSources(true), { staleTime: 15_000 })
  const rows = sources.data ?? []

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = uri.trim()
    if (!next) return
    void add.run(
      'add',
      async () => {
        const created = await addSource(next, kind.trim() || undefined)
        setUri('')
        setKind('')
        // Show the source even if the first scan fails to start; the scan has
        // its own error surface in the row action area.
        sources.reload()
        await scanSource(created.id)
      },
      () => sources.reload(),
    )
  }

  const scan = (source: Source) => {
    void row.run(`scan:${source.id}`, () => scanSource(source.id), () => sources.reload())
  }

  const toggleEnabled = (source: Source) => {
    void row.run(
      `enabled:${source.id}`,
      () => patchSource(source.id, { enabled: !source.enabled }),
      () => sources.reload(),
    )
  }

  const toggleArchived = (source: Source) => {
    void row.run(
      `archived:${source.id}`,
      () => patchSource(source.id, { archived: source.archived_at == null }),
      () => sources.reload(),
    )
  }

  const beginRemap = (source: Source) => {
    setRemapFor(source)
    setRemapUri(source.uri)
    setReport(null)
    remap.reset()
  }

  const previewRemap = () => {
    if (!remapFor) return
    const next = remapUri.trim()
    if (!next) return
    setReport(null)
    void remap.run('preview', () => remapSource(remapFor.id, next, true)).then(result => {
      if (result) setReport(result)
    })
  }

  const applyRemap = async () => {
    if (!remapFor || !report) return
    await remap.run(
      'apply',
      async () => {
        const applied = await remapSource(remapFor.id, remapUri.trim(), false)
        toast.push(
          t('sources.remap.moved', { moved: applied.media_moved, missing: applied.missing }),
          'success',
        )
        setRemapFor(null)
        setReport(null)
      },
      () => sources.reload(),
    )
  }

  const remove = async (source: Source) => {
    // A dry run first: the confirmation has to name what would go.
    const preview: DeleteSourceReport | undefined = await row.run(
      `preview-delete:${source.id}`,
      () => deleteSource(source.id, { dryRun: true }),
    )
    if (!preview) return

    const choice = { deleteMedia: false }
    const ok = await confirm({
      title: t('sources.delete.title', { uri: source.uri }),
      body: (
        <div className={styles.confirmBody}>
          <p>{t('sources.delete.body', { count: preview.media_count })}</p>
          <DeleteFilesChoice target={choice} />
        </div>
      ),
      confirmLabel: t('sources.action.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return

    await row.run(
      `delete:${source.id}`,
      () => deleteSource(source.id, { deleteMedia: choice.deleteMedia }),
      () => {
        sources.reload()
        toast.push(t('sources.delete.done'), 'success')
      },
    )
  }

  const columns: Array<Column<Source>> = [
    {
      key: 'uri',
      header: t('sources.table.uri'),
      cellClassName: styles.uriCell,
      render: source => (
        <span className={styles.uri} title={source.uri}>
          {source.uri}
        </span>
      ),
    },
    {
      key: 'kind',
      header: t('sources.table.kind'),
      width: '7rem',
      render: source => <span className={styles.mono}>{source.kind}</span>,
    },
    {
      key: 'media',
      header: t('sources.table.media'),
      align: 'right',
      width: '7rem',
      render: source => <SourceItems sourceId={source.id} />,
    },
    {
      key: 'state',
      header: t('sources.table.state'),
      render: source => <SourceState source={source} />,
    },
    {
      key: 'actions',
      header: t('sources.table.actions'),
      align: 'right',
      render: source => (
        <div className={styles.tableActions}>
          <Button
            size="sm"
            variant="ghost"
            icon="refresh"
            disabled={row.pending != null}
            onClick={() => scan(source)}
          >
            {t('sources.action.scan')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={row.pending != null}
            onClick={() => toggleEnabled(source)}
          >
            {source.enabled ? t('sources.action.disable') : t('sources.action.enable')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={row.pending != null}
            onClick={() => toggleArchived(source)}
          >
            {source.archived_at == null
              ? t('sources.action.archive')
              : t('sources.action.unarchive')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={row.pending != null}
            onClick={() => beginRemap(source)}
          >
            {t('sources.action.remap')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={row.pending != null}
            onClick={() => void remove(source)}
          >
            {t('sources.action.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className={styles.stack}>
      <Panel title={t('sources.add.label')}>
        <form className={styles.inlineForm} onSubmit={submit}>
          <div className={styles.fieldGrow}>
            <TextField
              label={t('sources.table.uri')}
              value={uri}
              onChange={event => setUri(event.target.value)}
              placeholder={t('sources.add.placeholder')}
              hint={t('sources.add.hint')}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className={styles.fieldNarrow}>
            <SelectField
              label={t('sources.add.kind')}
              value={kind}
              onChange={event => setKind(event.target.value)}
              hint={t('sources.add.kind.auto')}
              options={[
                { value: '', label: t('sources.add.kind.auto') },
                { value: 'local', label: 'local' },
                { value: 'hls', label: 'hls' },
              ]}
            />
          </div>
          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="primary"
              icon="plus"
              loading={add.pending === 'add'}
              disabled={!uri.trim() || add.pending != null}
            >
              {t('sources.add.action')}
            </Button>
          </div>
        </form>
        {add.error ? (
          <div className={styles.formError}>
            <Notice error={add.error} onDismiss={add.reset} />
          </div>
        ) : null}
      </Panel>

      {remapFor ? (
        <Panel
          title={t('sources.action.remap')}
          note={t('sources.remap.hint')}
          tools={
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              aria-label={t('common.close')}
              onClick={() => {
                setRemapFor(null)
                setReport(null)
              }}
            />
          }
        >
          <p className={styles.hintLine}>{remapFor.uri}</p>
          <div className={styles.formFoot}>
            <div className={styles.fieldGrow}>
              <TextField
                label={t('sources.table.uri')}
                value={remapUri}
                onChange={event => {
                  setRemapUri(event.target.value)
                  setReport(null)
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                loading={remap.pending === 'preview'}
                disabled={!remapUri.trim() || remap.pending != null}
                onClick={previewRemap}
              >
                {t('sources.remap.dryRun')}
              </Button>
              <Button
                variant="primary"
                icon="check"
                loading={remap.pending === 'apply'}
                disabled={report == null || remap.pending != null}
                onClick={() => void applyRemap()}
              >
                {t('sources.remap.apply')}
              </Button>
            </div>
          </div>
          {report ? (
            <p className={styles.ok}>
              {t('sources.remap.moved', { moved: report.media_moved, missing: report.missing })}
            </p>
          ) : null}
          {remap.error ? (
            <div className={styles.formError}>
              <Notice error={remap.error} onDismiss={remap.reset} />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {row.error ? <Notice error={row.error} onDismiss={row.reset} /> : null}

      <Panel title={t('sources.title')} note={t('sources.subtitle')} flush>
        {sources.error && sources.data === undefined ? (
          <div className={styles.pad}>
            <Notice error={sources.error} onDismiss={() => sources.reload()} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={source => source.id}
            loading={sources.loading}
            empty={t('sources.empty')}
          />
        )}
      </Panel>
    </div>
  )
}

function SourceState({ source }: { source: Source }) {
  const t = useT()
  return (
    <span className={styles.chips}>
      {source.archived_at != null ? (
        <Badge tone="outline">{t('sources.state.archived')}</Badge>
      ) : null}
      {source.enabled ? (
        <Badge tone="success">{t('sources.state.enabled')}</Badge>
      ) : (
        <Badge tone="neutral">{t('sources.state.disabled')}</Badge>
      )}
    </span>
  )
}

/**
 * The per-source item count.
 *
 * `GET /sources` does not carry it, so the count is one cached `limit=1` read
 * per row — the server still does the counting, and the cache dedupes across
 * renders and events.
 */
function SourceItems({ sourceId }: { sourceId: number }) {
  const { settings } = useSettings()
  const page = useQuery(
    `media:source:${sourceId}`,
    () => fetchMedia({ source_id: sourceId, limit: 1, include_archived: true }),
    { staleTime: 60_000 },
  )
  if (page.data) return <span>{formatNumber(page.data.total, settings.lang)}</span>
  return <span className={styles.hintLine}>{page.error ? '—' : '…'}</span>
}

function DeleteFilesChoice({ target }: { target: { deleteMedia: boolean } }) {
  const t = useT()
  const [checked, setChecked] = useState(false)
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => {
          target.deleteMedia = event.target.checked
          setChecked(event.target.checked)
        }}
      />
      <span>{t('sources.delete.files')}</span>
    </label>
  )
}
