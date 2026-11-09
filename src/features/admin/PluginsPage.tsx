import { useRef, useState } from 'react'

import { routeHref } from '../../app/match'
import { Link } from '../../app/router'
import {
  deleteStagedPackage,
  fetchAudit,
  fetchPlugins,
  fetchSandboxStatus,
  fetchStagedPackages,
  fetchVerifications,
  installStagedPackage,
  restartPlugin,
  setPluginEnabled,
  uploadPluginPackage,
  verifyVerificationChain,
} from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { PluginDescriptor, StagedPackage } from '../../data/types'
import { useT } from '../../i18n'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { TextField } from '../../ui/Field'
import { Icon } from '../../ui/Icons'
import { Panel } from '../../ui/Panel'
import { LoadingRow } from '../../ui/Spinner'
import { Notice, PLUGIN_STATE_KEY, PLUGIN_STATE_TONE, buttonClass, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * One card per sidecar process.
 *
 * The console can only start, stop and restart; capabilities, secrets, logs and
 * the audit trail belong to the plugin's own page, so the card links there
 * rather than growing a second surface.
 */
export function PluginsPage() {
  const t = useT()
  const plugins = useQuery('plugins', fetchPlugins, { staleTime: 15_000 })
  const sandbox = useQuery('plugins:sandbox', fetchSandboxStatus, { staleTime: 60_000 })
  const verifications = useQuery('plugins:verifications', () => fetchVerifications(10), {
    staleTime: 15_000,
  })
  const chain = useQuery('plugins:chain', verifyVerificationChain, { staleTime: 15_000 })
  const staged = useQuery('plugins:staged', fetchStagedPackages, { staleTime: 15_000 })
  const audit = useQuery('plugins:package-audit', () => fetchAudit(undefined, 50), {
    staleTime: 15_000,
  })
  const [installNotice, setInstallNotice] = useState<string | null>(null)
  const [publisher, setPublisher] = useState('')
  const [signature, setSignature] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const action = useAction()

  const toggle = (plugin: PluginDescriptor) => {
    void action.run(
      `toggle:${plugin.id}`,
      () => setPluginEnabled(plugin.id, !plugin.enabled),
      () => plugins.reload(),
    )
  }

  const restart = (plugin: PluginDescriptor) => {
    void action.run(
      `restart:${plugin.id}`,
      () => restartPlugin(plugin.id),
      () => plugins.reload(),
    )
  }

  const install = (package_: StagedPackage) => {
    void action.run(
      `install:${package_.id}:${package_.version}`,
      async () => {
        const result = await installStagedPackage(package_.id, package_.version)
        if (result.restarted) {
          setInstallNotice(
            t('plugins.staged.installedNow', {
              id: package_.id,
              version: package_.version,
            }),
          )
        } else if (result.restart_required) {
          setInstallNotice(
            t('plugins.staged.restartRequired', {
              id: package_.id,
              version: package_.version,
            }),
          )
        }
      },
      () => staged.reload(),
    )
  }

  const upload = (file: File) => {
    void action
      .run(
        'upload',
        async () => {
          const result = await uploadPluginPackage(
            file,
            publisher.trim() || undefined,
            signature.trim() || undefined,
          )
          setInstallNotice(
            t('plugins.staged.uploaded', {
              id: result.manifest.id,
              version: result.manifest.version,
            }),
          )
          setSignature('')
        },
        () => staged.reload(),
      )
      .finally(() => {
        if (fileInput.current) fileInput.current.value = ''
      })
  }

  const remove = (package_: StagedPackage) => {
    if (
      !window.confirm(
        t('plugins.staged.deletePrompt', {
          id: package_.id,
          version: package_.version,
        }),
      )
    ) {
      return
    }
    void action.run(
      `unstage:${package_.id}:${package_.version}`,
      () => deleteStagedPackage(package_.id, package_.version),
      () => staged.reload(),
    )
  }

  const rows = plugins.data ?? []
  const packageAuditRows = (audit.data ?? [])
    .filter(entry => entry.action.startsWith('package.'))
    .slice(0, 10)
  const sandboxReady =
    sandbox.data?.app_container === true &&
    (sandbox.data.platform === 'linux'
      ? sandbox.data.unshare_present
      : sandbox.data.platform === 'windows'
        ? sandbox.data.wrapper_present
        : false)

  return (
    <div className={styles.stack}>
      {action.error ? <Notice error={action.error} onDismiss={action.reset} /> : null}

      <Panel
        title={t('plugins.title')}
        note={t('plugins.subtitle')}
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={plugins.refreshing}
            onClick={() => plugins.reload()}
          />
        }
      >
        {sandbox.data ? (
          <div className={styles.cardMeta}>
            <Badge tone="outline">
              {t('plugins.sandbox.platform', { platform: sandbox.data.platform })}
            </Badge>
            <Badge tone={sandboxReady ? 'success' : 'warning'}>
              {sandboxReady ? t('plugins.sandbox.ready') : t('plugins.sandbox.unavailable')}
            </Badge>
            {sandbox.data.app_container &&
            sandbox.data.platform === 'windows' &&
            !sandbox.data.wrapper_present ? (
              <Badge tone="warning">{t('plugins.sandbox.wrapperMissing')}</Badge>
            ) : null}
            {sandbox.data.app_container && !sandbox.data.unshare_present && sandbox.data.platform === 'linux' ? (
              <Badge tone="warning">{t('plugins.sandbox.unshareMissing')}</Badge>
            ) : null}
          </div>
        ) : null}

        {plugins.error ? <Notice error={plugins.error} onDismiss={() => plugins.reload()} /> : null}

        {plugins.loading && plugins.data === undefined ? (
          <LoadingRow>{t('common.loading')}</LoadingRow>
        ) : plugins.error && plugins.data === undefined ? null : rows.length === 0 ? (
          <Empty title={t('plugins.empty')} body={t('plugins.emptyBody')} />
        ) : (
          <div className={styles.cards}>
            {rows.map(plugin => (
              <article key={plugin.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>{plugin.name}</h3>
                  <Badge tone={PLUGIN_STATE_TONE[plugin.state]}>
                    {t(PLUGIN_STATE_KEY[plugin.state])}
                  </Badge>
                  <span className={styles.cardVer}>
                    {t('plugins.version', { version: plugin.version })}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  <span>
                    {t('plugins.package')} <code>{plugin.package}</code>
                  </span>
                  <span>{t('plugins.restarts', { count: plugin.restarts })}</span>
                  {plugin.transport ? (
                    <Badge tone="outline">
                      {t('plugins.transport', { transport: plugin.transport })}
                    </Badge>
                  ) : null}
                  <Badge tone={plugin.sandbox === 'appcontainer' ? 'success' : 'outline'}>
                    {plugin.sandbox === 'appcontainer'
                      ? t('plugins.sandbox.appcontainer')
                      : t('plugins.sandbox.none')}
                  </Badge>
                  {plugin.network ? <Badge tone="outline">{t('plugins.network')}</Badge> : null}
                </div>

                <div>
                  <p className={styles.hintLine}>{t('plugins.permissions')}</p>
                  <div className={styles.chips}>
                    {plugin.permissions.length === 0 ? (
                      <span className={styles.hintLine}>{t('common.none')}</span>
                    ) : (
                      plugin.permissions.map(permission => (
                        <span key={permission} className={styles.chip}>
                          {permission}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {plugin.error ? (
                  <p className={styles.badCount}>
                    {t('plugins.error.last')}: {plugin.error}
                  </p>
                ) : null}

                <div className={styles.cardFoot}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="refresh"
                    loading={action.pending === `restart:${plugin.id}`}
                    disabled={!plugin.enabled || action.pending != null}
                    onClick={() => restart(plugin)}
                  >
                    {t('plugins.action.restart')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={action.pending === `toggle:${plugin.id}`}
                    disabled={action.pending != null}
                    onClick={() => toggle(plugin)}
                  >
                    {plugin.enabled
                      ? t('plugins.action.disable')
                      : t('plugins.action.enable')}
                  </Button>
                  <Link
                    to={routeHref('admin.plugin', { id: plugin.id })}
                    className={buttonClass('secondary', 'sm')}
                  >
                    {t('plugins.action.open')}
                    <Icon name="chevron-right" size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t('plugins.verifications.title')} note={t('plugins.verifications.note')}>
        {chain.data ? (
          <div className={styles.cardMeta}>
            <Badge tone={chain.data.valid ? 'success' : 'danger'}>
              {chain.data.valid
                ? t('plugins.verifications.valid')
                : t('plugins.verifications.broken', {
                    id: chain.data.broken_at ?? '',
                  })}
            </Badge>
            <Badge
              tone={
                chain.data.anchor_valid === true
                  ? 'success'
                  : chain.data.anchored
                    ? 'warning'
                    : 'outline'
              }
            >
              {!chain.data.anchored
                ? t('plugins.verifications.notAnchored')
                : chain.data.anchor_valid
                  ? t('plugins.verifications.anchored')
                  : t('plugins.verifications.anchorInvalid')}
            </Badge>
            <span>{t('plugins.verifications.checked', { count: chain.data.checked })}</span>
          </div>
        ) : null}

        {verifications.data?.length === 0 ? (
          <Empty title={t('plugins.verifications.empty')} body={t('plugins.verifications.emptyBody')} />
        ) : (
          <div className={styles.stack}>
            {verifications.data?.map(entry => (
              <div key={entry.id} className={styles.cardMeta}>
                <span>
                  {entry.plugin_id} {t('plugins.version', { version: entry.plugin_version })}
                </span>
                <code title={entry.package_sha256}>{entry.package_sha256.slice(0, 12)}…</code>
                <Badge tone={entry.signature_verified ? 'success' : 'warning'}>
                  {entry.signature_verified
                    ? t('plugins.verifications.signatureOk')
                    : t('plugins.verifications.signatureBad')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={t('plugins.staged.title')}
        note={t('plugins.staged.note')}
        tools={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            aria-label={t('common.refresh')}
            loading={staged.refreshing}
            onClick={() => staged.reload()}
          />
        }
      >
        {installNotice ? <p className={styles.muted}>{installNotice}</p> : null}
        <div className={styles.uploadForm}>
          <TextField
            label={t('plugins.staged.publisher')}
            value={publisher}
            onChange={event => setPublisher(event.target.value)}
            placeholder="acme"
          />
          <TextField
            label={t('plugins.staged.signature')}
            value={signature}
            onChange={event => setSignature(event.target.value)}
            placeholder="128 hex"
          />
          <label className={buttonClass('secondary', 'sm')}>
            <input
              ref={fileInput}
              type="file"
              accept=".lrplug,application/zip"
              hidden
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) upload(file)
              }}
            />
            {t('plugins.staged.upload')}
          </label>
        </div>
        {staged.data?.length === 0 ? (
          <Empty title={t('plugins.staged.empty')} body={t('plugins.staged.emptyBody')} />
        ) : (
          <div className={styles.stack}>
            {staged.data?.map(package_ => {
              const signed = package_.metadata?.signature_verified === true
              return (
                <div
                  key={`${package_.id}:${package_.version}`}
                  className={styles.cardMeta}
                >
                  <span>
                    <strong>{package_.id}</strong>{' '}
                    {t('plugins.version', { version: package_.version })}
                  </span>
                  <Badge tone={signed ? 'success' : 'warning'}>
                    {signed
                      ? t('plugins.staged.signed')
                      : t('plugins.staged.unsigned')}
                  </Badge>
                  <code title={package_.path}>
                    {package_.path.split(/[\\/]/).pop()}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!signed || action.pending != null}
                    loading={
                      action.pending === `install:${package_.id}:${package_.version}`
                    }
                    onClick={() => install(package_)}
                  >
                    {t('plugins.staged.install')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.pending != null}
                    loading={
                      action.pending === `unstage:${package_.id}:${package_.version}`
                    }
                    onClick={() => remove(package_)}
                  >
                    {t('plugins.staged.delete')}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel
        title={t('plugins.packageAudit.title')}
        note={t('plugins.packageAudit.note')}
      >
        {packageAuditRows.length === 0 ? (
          <Empty
            title={t('plugins.packageAudit.empty')}
            body={t('plugins.packageAudit.emptyBody')}
          />
        ) : (
          <div className={styles.stack}>
            {packageAuditRows.map(entry => (
              <div key={entry.id} className={styles.cardMeta}>
                <span>
                  <strong>{entry.action}</strong> {entry.plugin_id}
                </span>
                <Badge tone={entry.result === 'rejected' ? 'warning' : 'success'}>
                  {entry.result ?? t('common.none')}
                </Badge>
                {entry.detail ? <span className={styles.muted}>{entry.detail}</span> : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
