import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  ApiError,
  fetchAuthStatus,
  login as apiLogin,
  logout as apiLogout,
  setUnauthorizedHandler,
  setupOwner,
  type User,
} from './api'
import LangSwitch from './LangSwitch'
import { useLang, type Translate } from './i18n'

interface AuthContextValue {
  user: User
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** The signed-in account. Only valid inside [`AuthGate`]. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthGate')
  return value
}

type Phase = 'loading' | 'setup' | 'login' | 'ready'

/**
 * Holds the session for the whole app: first-run setup, sign-in, and the
 * signed-in account every page can read.
 *
 * The server is the authority (an empty owner password means "not configured"),
 * so the gate asks `/api/v1/auth/status` before rendering anything.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useLang()
  const [phase, setPhase] = useState<Phase>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const status = await fetchAuthStatus()
      if (status.setup_required) {
        setPhase('setup')
        return
      }
      if (!status.authenticated || !status.user) {
        setPhase('login')
        return
      }
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

  // An expired session anywhere in the app drops back to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setPhase('login')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setPhase('login')
  }, [])

  if (phase === 'loading') {
    return (
      <AuthShell lang={lang} setLang={setLang} t={t}>
        <p className="notice">{t('auth.loading')}</p>
      </AuthShell>
    )
  }

  if (phase === 'setup') {
    return (
      <AuthShell lang={lang} setLang={setLang} t={t}>
        <AccountForm
          t={t}
          mode="setup"
          problem={problem}
          onProblem={setProblem}
          onDone={signedIn => {
            setUser(signedIn)
            setPhase('ready')
          }}
        />
      </AuthShell>
    )
  }

  if (phase === 'login') {
    return (
      <AuthShell lang={lang} setLang={setLang} t={t}>
        <AccountForm
          t={t}
          mode="login"
          problem={problem}
          onProblem={setProblem}
          onDone={signedIn => {
            setUser(signedIn)
            setPhase('ready')
          }}
        />
      </AuthShell>
    )
  }

  return (
    <AuthContext.Provider value={{ user: user as User, logout: signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function AuthShell({
  lang,
  setLang,
  t,
  children,
}: {
  lang: 'zh' | 'en'
  setLang: (lang: 'zh' | 'en') => void
  t: Translate
  children: ReactNode
}) {
  return (
    <main className="shell auth-shell">
      <header className="topbar">
        <div>
          <p className="kicker">{t('auth.kicker')}</p>
          <h1>LocalReel</h1>
        </div>
        <div className="topbar-right">
          <LangSwitch lang={lang} onChange={setLang} t={t} />
        </div>
      </header>
      <section className="panel auth-panel">{children}</section>
    </main>
  )
}

function AccountForm({
  t,
  mode,
  problem,
  onProblem,
  onDone,
}: {
  t: Translate
  mode: 'login' | 'setup'
  problem: string | null
  onProblem: (message: string | null) => void
  onDone: (user: User) => void
}) {
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
          : await apiLogin(username.trim(), password)
      onDone(signedIn)
    } catch (error) {
      const detail =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : String(error)
      onProblem(
        t(mode === 'setup' ? 'auth.error.setup' : 'auth.error.failed', {
          message: detail,
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={event => void submit(event)}>
      <h2>{t(mode === 'setup' ? 'auth.setup.title' : 'auth.signIn.title')}</h2>
      <p className="muted">
        {t(mode === 'setup' ? 'auth.setup.subtitle' : 'auth.signIn.subtitle')}
      </p>

      {problem && <p className="notice error">{problem}</p>}

      <label className="field">
        <span>{t('auth.field.username')}</span>
        <input
          autoComplete="username"
          autoFocus
          value={username}
          onChange={event => setUsername(event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('auth.field.password')}</span>
        <input
          type="password"
          autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>

      {mode === 'setup' && (
        <label className="field">
          <span>{t('auth.field.confirm')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
          />
        </label>
      )}

      <p className="hint">{t('auth.hint.password')}</p>

      <button type="submit" className="primary" disabled={busy}>
        {busy
          ? t('auth.action.working')
          : t(mode === 'setup' ? 'auth.action.setup' : 'auth.action.signIn')}
      </button>
    </form>
  )
}
