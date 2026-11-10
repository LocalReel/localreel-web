import { useState } from 'react'

import { useSettings } from '../../app/settings'
import {
  deleteSecret,
  fetchCapabilities,
  fetchSecrets,
  grantCapability,
  revokeCapability,
  setSecret,
} from '../../data/client'
import { useQuery } from '../../data/hooks'
import type {
  CapabilityDescriptor,
  CapabilityGrant,
  RequestedCapability,
  SecretHandle,
} from '../../data/types'
import { useT } from '../../i18n'
import { formatDateTime } from '../../lib/format'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { Dialog } from '../../ui/Dialog'
import { useConfirm, useToast } from '../../ui/Feedback'
import { TextField } from '../../ui/Field'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Notice, scopeText, useAction } from '../admin/shared'
import styles from '../admin/Admin.module.css'

/**
 * Capabilities: what the plugin asks for, what the host would allow, and what
 * an administrator actually granted for the version now running.
 *
 * The UI never invents a capability: the "requested" list comes from the
 * manifest, the catalog from the host, and only an explicit grant bridges them.
 * Legacy permissions are shown but not grantable — the host maps them for
 * compatibility and refuses an explicit grant.
 */
export function CapabilitiesSection({ pluginId }: { pluginId: string }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const confirm = useConfirm()
  const caps = useQuery(`plugins:caps:${pluginId}`, () => fetchCapabilities(pluginId), {
    staleTime: 10_000,
  })
  const action = useAction()
  const report = caps.data

  const grantedNames = new Set(
    (report?.granted ?? []).filter(grant => grant.revoked_at == null).map(grant => grant.capability),
  )

  const grant = async (request: RequestedCapability) => {
    const ok = await confirm({
      title: t('plugins.capabilities.grantPrompt', { name: request.name }),
      body: request.description,
      confirmLabel: t('plugins.capabilities.grant'),
      cancelLabel: t('common.cancel'),
    })
    if (!ok) return
    await action.run(
      `grant:${request.name}`,
      () => grantCapability(pluginId, request.name, request.scope),
      () => caps.reload(),
    )
  }

  const revoke = async (granted: CapabilityGrant) => {
    const ok = await confirm({
      title: t('plugins.capabilities.revokePrompt', { name: granted.capability }),
      body: t('plugins.capabilities.grantedAt', {
        when: formatDateTime(granted.granted_at, lang),
      }),
      confirmLabel: t('plugins.capabilities.revoke'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return
    await action.run(
      `revoke:${granted.capability}`,
      () => revokeCapability(pluginId, granted.capability),
      () => caps.reload(),
    )
  }

  const grantedRows = (report?.granted ?? []).filter(granted => granted.revoked_at == null)

  const grantedColumns: Array<Column<CapabilityGrant>> = [
    {
      key: 'capability',
      header: t('plugins.audit.capability'),
      render: granted => <span className={styles.mono}>{granted.capability}</span>,
    },
    {
      key: 'tier',
      header: t('plugins.capabilities.tier', { tier: '' }).trim(),
      width: '6rem',
      render: granted => <span>T{granted.tier}</span>,
    },
    {
      key: 'grantedAt',
      header: t('plugins.capabilities.grantedAt', { when: '' }).trim(),
      width: '14rem',
      render: granted => <span>{formatDateTime(granted.granted_at, lang)}</span>,
    },
    {
      key: 'expires',
      header: t('plugins.capabilities.expires', { when: '' }).trim(),
      width: '14rem',
      render: granted =>
        granted.expires_at ? (
          <span>{formatDateTime(granted.expires_at, lang)}</span>
        ) : (
          <span className={styles.hintLine}>{t('common.never')}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: granted => (
        <Button
          size="sm"
          variant="danger"
          disabled={action.pending != null}
          onClick={() => void revoke(granted)}
        >
          {t('plugins.capabilities.revoke')}
        </Button>
      ),
    },
  ]

  const catalogColumns: Array<Column<CapabilityDescriptor>> = [
    {
      key: 'name',
      header: t('plugins.audit.capability'),
      render: entry => <span className={styles.mono}>{entry.name}</span>,
    },
    {
      key: 'tier',
      header: t('plugins.capabilities.tier', { tier: '' }).trim(),
      width: '6rem',
      render: entry => <span>T{entry.tier}</span>,
    },
    {
      key: 'title',
      header: t('common.details'),
      render: entry => <span>{entry.title}</span>,
    },
  ]

  return (
    <Panel
      title={t('plugins.detail.capabilities')}
      tools={
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          aria-label={t('common.refresh')}
          loading={caps.refreshing}
          onClick={() => caps.reload()}
        />
      }
    >
      {caps.error ? <Notice error={caps.error} onDismiss={() => caps.reload()} /> : null}
      {action.error ? <Notice error={action.error} onDismiss={action.reset} /> : null}

      {report == null ? (
        caps.loading ? (
          <LoadingRow>{t('common.loading')}</LoadingRow>
        ) : null
      ) : (
        <>
          {(() => {
            if (!report.requires_grant) return null
            const pending = report.pending?.length
              ? report.pending
              : report.requested
                  .filter(request => !grantedNames.has(request.name))
                  .map(request => request.name)
            if (pending.length === 0) return null
            return (
              <div className={styles.grantWarning} role="status">
                <Icon name="alert" size={15} />
                <p>{t('plugins.capabilities.needsGrant', { list: pending.join(', ') })}</p>
              </div>
            )
          })()}
          <h3 className={styles.subHead}>{t('plugins.capabilities.requested')}</h3>
          {report.requested.length === 0 ? (
            <p className={styles.muted}>{t('plugins.capabilities.none')}</p>
          ) : (
            <ul className={styles.capList}>
              {report.requested.map(request => {
                const active = grantedNames.has(request.name)
                return (
                  <li key={request.name} className={styles.capItem}>
                    <div className={styles.capHead}>
                      <code className={styles.capName}>{request.name}</code>
                      <Badge tone="outline">
                        {t('plugins.capabilities.tier', { tier: request.tier })}
                      </Badge>
                      <Badge tone="neutral">
                        {request.source === 'legacy'
                          ? t('plugins.capabilities.legacy')
                          : t('plugins.capabilities.manifest')}
                      </Badge>
                      {active ? (
                        <Badge tone="success">{t('plugins.capabilities.granted')}</Badge>
                      ) : null}
                    </div>
                    <p className={styles.capTitle}>{request.title}</p>
                    <p className={styles.capDesc}>{request.description}</p>
                    <p className={styles.capAudit}>
                      {t('plugins.capabilities.audit', { level: request.audit })}
                    </p>
                    <code className={styles.scope}>{scopeText(request.scope)}</code>
                    {active ? null : request.source === 'legacy' ? (
                      <p className={styles.hintLine}>{t('plugins.capabilities.legacyHint')}</p>
                    ) : (
                      <Button
                        className={styles.capAction}
                        size="sm"
                        variant="secondary"
                        icon="key"
                        loading={action.pending === `grant:${request.name}`}
                        disabled={action.pending != null}
                        onClick={() => void grant(request)}
                      >
                        {t('plugins.capabilities.grant')}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <h3 className={styles.subHead}>{t('plugins.capabilities.granted')}</h3>
          <DataTable
            columns={grantedColumns}
            rows={grantedRows}
            rowKey={granted => granted.id}
            loading={caps.loading}
            empty={t('plugins.capabilities.none')}
          />

          <h3 className={styles.subHead}>{t('plugins.capabilities.forbidden')}</h3>
          {report.forbidden.length === 0 ? (
            <p className={styles.muted}>{t('common.none')}</p>
          ) : (
            <div className={styles.chips}>
              {report.forbidden.map(name => (
                <Badge key={name} tone="danger">
                  {name}
                </Badge>
              ))}
            </div>
          )}

          <details className={styles.disclose}>
            <summary>{t('plugins.capabilities.catalog')}</summary>
            <DataTable
              columns={catalogColumns}
              rows={report.catalog}
              rowKey={entry => entry.name}
              empty={t('common.none')}
            />
          </details>
        </>
      )}
    </Panel>
  )
}

interface SecretForm {
  handle: string
  value: string
  existing: boolean
}

/**
 * Secret values travel in only one direction: the admin pastes one, the host
 * stores it, and the plugin receives it when it asks for the handle. No screen
 * can read one back, which is why the table only lists handles.
 */
export function SecretsSection({ pluginId }: { pluginId: string }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const confirm = useConfirm()
  const toast = useToast()
  const secrets = useQuery(`plugins:secrets:${pluginId}`, () => fetchSecrets(pluginId), {
    staleTime: 10_000,
  })
  const action = useAction()
  const [form, setForm] = useState<SecretForm | null>(null)

  const openNew = () => {
    action.reset()
    setForm({ handle: '', value: '', existing: false })
  }

  const openRotate = (secret: SecretHandle) => {
    action.reset()
    setForm({ handle: secret.handle, value: '', existing: true })
  }

  const save = async () => {
    if (!form) return
    const handle = form.handle.trim()
    if (!handle || !form.value) return
    const saved = await action.run('save', async () => {
      await setSecret(pluginId, handle, form.value)
      return true
    })
    if (!saved) return
    toast.push(t('plugins.secrets.saved'), 'success')
    setForm(null)
    secrets.reload()
  }

  const remove = async (secret: SecretHandle) => {
    const ok = await confirm({
      title: t('plugins.secrets.confirmDelete', { handle: secret.handle }),
      confirmLabel: t('plugins.secrets.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return
    void action.run(`delete:${secret.handle}`, () => deleteSecret(pluginId, secret.handle), () => {
      secrets.reload()
      toast.push(t('plugins.secrets.deleted'), 'success')
    })
  }

  const columns: Array<Column<SecretHandle>> = [
    {
      key: 'handle',
      header: t('plugins.secrets.handle'),
      render: secret => <span className={styles.mono}>{secret.handle}</span>,
    },
    {
      key: 'updated',
      header: t('plugins.secrets.updated'),
      width: '14rem',
      render: secret => <span>{formatDateTime(secret.updated_at, lang)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: secret => (
        <div className={styles.tableActions}>
          <Button
            size="sm"
            variant="ghost"
            disabled={action.pending != null}
            onClick={() => openRotate(secret)}
          >
            {t('plugins.secrets.set')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={action.pending != null}
            onClick={() => void remove(secret)}
          >
            {t('plugins.secrets.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Panel
      title={t('plugins.detail.secrets')}
      note={t('plugins.secrets.body')}
      tools={
        <Button size="sm" variant="secondary" icon="plus" onClick={openNew}>
          {t('plugins.secrets.set')}
        </Button>
      }
    >
      {secrets.error ? <Notice error={secrets.error} onDismiss={() => secrets.reload()} /> : null}
      {action.error && form == null ? <Notice error={action.error} onDismiss={action.reset} /> : null}

      <DataTable
        columns={columns}
        rows={secrets.data ?? []}
        rowKey={secret => secret.handle}
        loading={secrets.loading}
        empty={t('plugins.secrets.empty')}
      />

      <Dialog
        open={form != null}
        title={t('plugins.secrets.set')}
        description={t('plugins.secrets.body')}
        onClose={() => setForm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              loading={action.pending === 'save'}
              disabled={!form?.handle.trim() || !form?.value}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className={styles.stackTight}>
          <TextField
            label={t('plugins.secrets.handle')}
            value={form?.handle ?? ''}
            onChange={event =>
              setForm(current => (current ? { ...current, handle: event.target.value } : current))
            }
            disabled={form?.existing}
            autoComplete="off"
            spellCheck={false}
          />
          <TextField
            label={t('plugins.secrets.value')}
            type="password"
            value={form?.value ?? ''}
            onChange={event =>
              setForm(current => (current ? { ...current, value: event.target.value } : current))
            }
            placeholder={t('plugins.secrets.placeholder')}
            autoComplete="new-password"
          />
          {action.error ? <Notice error={action.error} onDismiss={action.reset} /> : null}
        </div>
      </Dialog>
    </Panel>
  )
}
