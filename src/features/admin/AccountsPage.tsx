import { useState, type FormEvent } from 'react'

import { useSettings } from '../../app/settings'
import { createUser, deleteUser, fetchUsers, updateUser } from '../../data/client'
import { useQuery } from '../../data/hooks'
import type { Role, User } from '../../data/types'
import { useT } from '../../i18n'
import { formatDateTime } from '../../lib/format'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { Dialog } from '../../ui/Dialog'
import { useConfirm, useToast } from '../../ui/Feedback'
import { SelectField, TextField } from '../../ui/Field'
import { Panel } from '../../ui/Panel'
import { useAuth } from '../auth/context'
import { SessionsPanel } from './SessionsPanel'
import { Notice, useAction } from './shared'
import styles from './Admin.module.css'

/**
 * Accounts are per-person watch progress, so the dangerous verbs are the ones
 * that touch identity: disable, reset, delete. The owner account (id 1) and the
 * signed-in account cannot be deleted from here.
 */
export function AccountsPage() {
  const t = useT()
  const { settings } = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const { user: me } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [resetFor, setResetFor] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const users = useQuery('users', fetchUsers, { staleTime: 15_000 })
  const create = useAction()
  const row = useAction()
  const reset = useAction()

  const rows = users.data ?? []

  const submitCreate = (event: FormEvent) => {
    event.preventDefault()
    const name = username.trim()
    if (!name || password.length < 8) return
    void create.run(
      'create',
      async () => {
        await createUser(name, password, role)
        setUsername('')
        setPassword('')
        setRole('user')
      },
      () => users.reload(),
    )
  }

  const toggleEnabled = (user: User) => {
    void row.run(
      `enabled:${user.id}`,
      () => updateUser(user.id, { enabled: !user.enabled }),
      () => users.reload(),
    )
  }

  const remove = async (user: User) => {
    const ok = await confirm({
      title: t('accounts.action.delete'),
      body: t('accounts.confirm.delete', { name: user.username }),
      confirmLabel: t('accounts.action.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!ok) return
    await row.run(`delete:${user.id}`, () => deleteUser(user.id), () => users.reload())
  }

  const closeReset = () => {
    setResetFor(null)
    setNewPassword('')
    reset.reset()
  }

  const submitReset = async () => {
    if (!resetFor || newPassword.length < 8) return
    const done = await reset.run('reset', () =>
      updateUser(resetFor.id, { password: newPassword }),
    )
    if (!done) return
    toast.push(t('accounts.reset.done'), 'success')
    closeReset()
  }

  const columns: Array<Column<User>> = [
    {
      key: 'user',
      header: t('accounts.table.user'),
      render: user => (
        <span className={styles.chips}>
          <span>{user.username}</span>
          {user.id === me.id ? <Badge tone="accent">{t('accounts.self')}</Badge> : null}
          {user.id === 1 ? <Badge tone="outline">{t('accounts.owner')}</Badge> : null}
          {!user.enabled ? <Badge tone="neutral">{t('common.disabled')}</Badge> : null}
        </span>
      ),
    },
    {
      key: 'role',
      header: t('accounts.table.role'),
      width: '10rem',
      render: user => (
        <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
          {t(user.role === 'admin' ? 'auth.role.admin' : 'auth.role.user')}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: t('accounts.table.lastLogin'),
      width: '13rem',
      render: user =>
        user.last_login_at ? (
          <span>{formatDateTime(user.last_login_at, settings.lang)}</span>
        ) : (
          <span className={styles.hintLine}>{t('common.never')}</span>
        ),
    },
    {
      key: 'actions',
      header: t('accounts.table.actions'),
      align: 'right',
      render: user => (
        <div className={styles.tableActions}>
          <Button
            size="sm"
            variant="ghost"
            disabled={row.pending != null}
            onClick={() => {
              reset.reset()
              setNewPassword('')
              setResetFor(user)
            }}
          >
            {t('accounts.action.reset')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={row.pending != null || user.id === me.id}
            onClick={() => toggleEnabled(user)}
          >
            {user.enabled ? t('accounts.action.disable') : t('accounts.action.enable')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={row.pending != null || user.id === me.id || user.id === 1}
            onClick={() => void remove(user)}
          >
            {t('accounts.action.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className={styles.stack}>
      <Panel title={t('accounts.add.action')} note={t('accounts.subtitle')}>
        <form className={styles.inlineForm} onSubmit={submitCreate}>
          <div className={styles.fieldGrow}>
            <TextField
              label={t('accounts.add.username')}
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className={styles.fieldGrow}>
            <TextField
              label={`${t('accounts.add.password')} · ${t('auth.hint.password')}`}
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.fieldNarrow}>
            <SelectField
              label={t('accounts.add.role')}
              value={role}
              onChange={event => setRole(event.target.value as Role)}
              options={[
                { value: 'user', label: t('auth.role.user') },
                { value: 'admin', label: t('auth.role.admin') },
              ]}
            />
          </div>
          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="primary"
              icon="plus"
              loading={create.pending === 'create'}
              disabled={!username.trim() || password.length < 8 || create.pending != null}
            >
              {t('accounts.add.action')}
            </Button>
          </div>
        </form>
        {create.error ? (
          <div className={styles.formError}>
            <Notice error={create.error} onDismiss={create.reset} />
          </div>
        ) : null}
      </Panel>

      {row.error ? <Notice error={row.error} onDismiss={row.reset} /> : null}

      <Panel title={t('accounts.title')} flush>
        {users.error && users.data === undefined ? (
          <div className={styles.pad}>
            <Notice error={users.error} onDismiss={() => users.reload()} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={user => user.id}
            loading={users.loading}
            empty={t('accounts.empty')}
          />
        )}
      </Panel>

      <SessionsPanel />

      <Dialog
        open={resetFor != null}
        title={t('accounts.action.reset')}
        description={t('accounts.confirm.reset', { name: resetFor?.username ?? '' })}
        onClose={closeReset}
        footer={
          <>
            <Button variant="ghost" onClick={closeReset}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void submitReset()}
              loading={reset.pending === 'reset'}
              disabled={newPassword.length < 8}
            >
              {t('accounts.action.reset')}
            </Button>
          </>
        }
      >
        <TextField
          label={t('accounts.add.password')}
          type="password"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          hint={t('auth.hint.password')}
          autoComplete="new-password"
        />
        {reset.error ? (
          <div className={styles.formError}>
            <Notice error={reset.error} onDismiss={reset.reset} />
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
