import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'

import {
  ApiError,
  fetchAuthStatus,
  login,
  logout as apiLogout,
  setCsrfToken,
  setUnauthorizedHandler,
  setupOwner,
} from '../../data/client'
import { cache } from '../../data/cache'
import { useLang, useT } from '../../i18n'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Icon } from '../../ui/Icons'
import { Spinner } from '../../ui/Spinner'
import styles from './Auth.module.css'
import { AuthContext, type SessionUser } from './context'

type Phase = 'loading' | 'setup' | 'login' | 'ready'

/**
 * Owns the session for the whole app.
 *
 * The server is the authority: an empty owner password means "not configured",
 * so nothing renders until `/auth/status` answers. A reload keeps the cookie
 * but loses the CSRF token, which is why the token is re-read from that same
 * response instead of being stored.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const t = useT()
  const { lang, setLang } = useLang()
  const [phase, setPhase] = useState<Phase>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const status = await fetchAuthStatus()
      if (status.setup_required) {
        setPhase('setup')
        return
      }
      if (!status.authenticated || !status.user) {
        setCsrfToken(null)
        setPhase('login')
        return
      }
      setCsrfToken(status.csrf ?? null)
      setUser(status.user)
      setPhase('ready')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
      setPhase('login')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Any 401 anywhere drops back to sign-in and clears cached reads: they belong
  // to an account that is no longer signed in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      cache.clear()
      setUser(null)
      setPhase('login')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    cache.clear()
    setUser(null)
    setPhase('login')
  }, [])

  if (phase === 'ready' && user) {
    return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>
  }

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <div className={styles.brand}>
          <p className={styles.kicker}>{t('auth.kicker')}</p>
          <h1 className={styles.wordmark}>LocalReel</h1>
          <p className={styles.lede}>
            {t(phase === 'setup' ? 'auth.setup.subtitle' : 'auth.login.subtitle')}
          </p>
        </div>

        <section className={styles.card} aria-live="polite">
          {phase === 'loading' ? (
            <div className={styles.foot}>
              <Spinner />
              <span className={styles.hint}>{t('auth.loading')}</span>
            </div>
          ) : (
            <AccountForm
              mode={phase === 'setup' ? 'setup' : 'login'}
              problem={problem}
              onProblem={setProblem}
              onDone={signedIn => {
                setUser(signedIn)
                setPhase('ready')
              }}
            />
          )}

          <div className={styles.foot}>
            <button
              type="button"
              className={styles.hint}
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            >
              <Icon name="globe" size={13} /> {lang === 'zh' ? 'English' : '中文'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function AccountForm({
  mode,
  problem,
  onProblem,
  onDone,
}: {
  mode: 'login' | 'setup'
  problem: string | null
  onProblem: (message: string | null) => void
  onDone: (user: SessionUser) => void
}) {
  const t = useT()
  const [username, setUsername] = useState(mode === 'setup' ? 'admin' : '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'setup' && password !== confirm) {
      onProblem(t('auth.error.mismatch'))
      return
    }
    setBusy(true)
    onProblem(null)
    try {
      const signedIn =
        mode === 'setup'
          ? await setupOwner(username.trim(), password)
          : await login(username.trim(), password)
      onDone(signedIn)
    } catch (error) {
      const detail = error instanceof ApiError || error instanceof Error ? error.message : String(error)
      onProblem(t(mode === 'setup' ? 'auth.error.setup' : 'auth.error.login', { message: detail }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header>
        <h2 className={styles.title}>
          {t(mode === 'setup' ? 'auth.setup.title' : 'auth.login.title')}
        </h2>
      </header>

      {problem ? <p className={styles.problem}>{problem}</p> : null}

      <form className={styles.form} onSubmit={event => void submit(event)}>
        <TextField
          label={t('auth.field.username')}
          autoComplete="username"
          autoFocus
          value={username}
          onChange={event => setUsername(event.target.value)}
        />
        <TextField
          label={t('auth.field.password')}
          type="password"
          autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={event => setPassword(event.target.value)}
          hint={mode === 'setup' ? t('auth.hint.password') : undefined}
        />
        {mode === 'setup' ? (
          <TextField
            label={t('auth.field.confirm')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
          />
        ) : null}

        <Button type="submit" variant="primary" size="lg" loading={busy} className={styles.submit}>
          {busy
            ? t('auth.action.working')
            : t(mode === 'setup' ? 'auth.action.setup' : 'auth.action.signIn')}
        </Button>
      </form>
    </>
  )
}
