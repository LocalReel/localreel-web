import { useState, type ChangeEvent } from 'react'

import { backupUrl, importBackup, restoreBackupUpload } from '../../data/client'
import { useMutation } from '../../data/hooks'
import type { BackupReport } from '../../data/types'
import { useT } from '../../i18n'
import { Button } from '../../ui/Button'
import { useConfirm } from '../../ui/Feedback'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { Notice, buttonClass } from './shared'
import styles from './Admin.module.css'

/**
 * Two different operations that both start with a file:
 *
 *  - an *import* merges accounts, likes and progress over the current data;
 *  - a *restore* replaces the index and re-scans, so it runs as a job.
 *
 * They get separate panels and separate confirmations so nobody triggers the
 * heavier one by reaching for the lighter one.
 */
export function BackupPage() {
  const t = useT()
  const confirm = useConfirm()

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importText, setImportText] = useState('')
  const [readError, setReadError] = useState<unknown>(null)
  const [preview, setPreview] = useState<BackupReport | null>(null)
  const [applied, setApplied] = useState<BackupReport | null>(null)

  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreJob, setRestoreJob] = useState<string | null>(null)

  const [runPreview, previewState] = useMutation(
    (text: string) => importBackup(text, true),
    { onDone: report => setPreview(report) },
  )
  const [runImport, importState] = useMutation(
    (text: string) => importBackup(text, false),
    {
      invalidate: ['sources', 'users', 'media', 'feed', 'series', 'admin'],
      onDone: report => {
        setPreview(null)
        setApplied(report)
      },
    },
  )
  const [runRestore, restoreState] = useMutation(restoreBackupUpload, {
    invalidate: ['jobs', 'admin'],
    onDone: result => setRestoreJob(result.job_id),
  })

  const chooseImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Let the same file be chosen twice after a failed preview.
    event.target.value = ''
    if (!file) return
    setImportFile(file)
    setImportText('')
    setPreview(null)
    setApplied(null)
    setReadError(null)
    try {
      setImportText(await file.text())
    } catch (cause) {
      setReadError(cause)
    }
  }

  const previewImport = () => {
    if (!importText) return
    void runPreview(importText)
  }

  const applyImport = async () => {
    if (!importText) return
    const report = preview
    const ok = await confirm({
      title: t('backup.confirm.apply'),
      body: report
        ? t('backup.result', {
            imported: report.imported,
            unchanged: report.unchanged,
            missing: report.missing,
          })
        : undefined,
      confirmLabel: t('backup.apply'),
      cancelLabel: t('common.cancel'),
    })
    if (!ok) return
    void runImport(importText)
  }

  const chooseRestore = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    setRestoreFile(file)
    setRestoreJob(null)
  }

  const restore = async () => {
    if (!restoreFile) return
    const ok = await confirm({
      title: t('backup.confirm.restore'),
      body: t('backup.restore.note'),
      confirmLabel: t('backup.restore'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return
    void runRestore(restoreFile)
  }

  const report = preview ?? applied

  return (
    <div className={styles.stack}>
      <Panel title={t('backup.export')} note={t('backup.export.note')}>
        <a className={buttonClass('secondary')} href={backupUrl()} download>
          <Icon name="download" size={17} />
          {t('backup.export')}
        </a>
      </Panel>

      <Panel title={t('backup.import')} note={t('backup.import.note')}>
        <div className={styles.formActions}>
          <label className={styles.fileField}>
            <Icon name="upload" size={17} />
            <span>{t('backup.choose')}</span>
            <input
              className={styles.fileInput}
              type="file"
              accept="application/json,.json"
              onChange={event => void chooseImport(event)}
            />
          </label>
          {importFile ? (
            <span className={styles.fileName} title={importFile.name}>
              {importFile.name}
            </span>
          ) : null}
        </div>

        <div className={styles.formFoot}>
          <Button
            variant="secondary"
            icon="list"
            loading={previewState.pending}
            disabled={!importText || previewState.pending}
            onClick={previewImport}
          >
            {t('backup.preview')}
          </Button>
          <Button
            variant="primary"
            icon="upload"
            loading={importState.pending}
            disabled={preview == null || importState.pending}
            onClick={() => void applyImport()}
          >
            {t('backup.apply')}
          </Button>
        </div>

        {readError ? (
          <div className={styles.formError}>
            <Notice error={readError} onDismiss={() => setReadError(null)} />
          </div>
        ) : null}
        {previewState.error ? (
          <div className={styles.formError}>
            <Notice error={previewState.error} />
          </div>
        ) : null}
        {importState.error ? (
          <div className={styles.formError}>
            <Notice error={importState.error} />
          </div>
        ) : null}

        {report ? (
          <div className={styles.formFoot}>
            <div>
              <p className={applied ? styles.ok : styles.muted}>
                {t('backup.result', {
                  imported: report.imported,
                  unchanged: report.unchanged,
                  missing: report.missing,
                })}
              </p>
              {report.warnings.length > 0 ? (
                <div className={styles.warnings}>
                  <p className={styles.choiceLabel}>{t('backup.warnings')}</p>
                  <ul>
                    {report.warnings.map(warning => (
                      <li key={warning} className={styles.warning}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title={t('backup.restore')} note={t('backup.restore.note')}>
        <div className={styles.formActions}>
          <label className={styles.fileField}>
            <Icon name="upload" size={17} />
            <span>{t('backup.choose')}</span>
            <input
              className={styles.fileInput}
              type="file"
              accept="application/json,.json"
              onChange={chooseRestore}
            />
          </label>
          {restoreFile ? (
            <span className={styles.fileName} title={restoreFile.name}>
              {restoreFile.name}
            </span>
          ) : null}
        </div>

        <div className={styles.formFoot}>
          <Button
            variant="danger"
            icon="upload"
            loading={restoreState.pending}
            disabled={!restoreFile || restoreState.pending}
            onClick={() => void restore()}
          >
            {t('backup.restore')}
          </Button>
        </div>

        {restoreState.error ? (
          <div className={styles.formError}>
            <Notice error={restoreState.error} />
          </div>
        ) : null}
        {restoreJob ? (
          <p className={styles.ok}>{t('backup.restore.queued', { id: restoreJob })}</p>
        ) : null}
      </Panel>
    </div>
  )
}
