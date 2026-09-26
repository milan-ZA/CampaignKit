import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, InlineError, Logo, Spinner } from '../components/ui'
import { ACCOUNT_DELETED_KEY } from '../lib/api'
import { supabase } from '../lib/supabase'

/** One-time note after "Delete my account" on the Account settings page. */
function readAccountDeletedNotice() {
  try {
    return sessionStorage.getItem(ACCOUNT_DELETED_KEY)
      ? 'Your account and everything in it has been deleted. Thanks for trying CampaignKit.'
      : null
  } catch {
    return null
  }
}

function friendlyAuthError(error) {
  const msg = error?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match. Please check and try again."
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for our link.'
  if (/already registered|already exists/i.test(msg)) return 'There is already an account with this email. Try logging in.'
  if (/password.*(at least|short)/i.test(msg)) return 'Please use a password with at least 6 characters.'
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Please wait a minute and try again.'
  if (/fetch|network/i.test(msg)) return "We couldn't reach the server. Check your connection and try again."
  return msg || 'Something went wrong. Please try again.'
}

export function AuthShell({ children }) {
  return (
    <div className="grid min-h-dvh wide:grid-cols-2">
      <aside className="flex flex-col justify-between gap-10 bg-header p-8 text-on-header sm:p-12">
        <Logo onDark size="lg" />
        <div className="max-w-md">
          <h1 className="text-3xl leading-tight !text-on-header sm:text-4xl">One brief in. One marketing plan out.</h1>
          <p className="mt-4 text-base text-on-header-muted">
            Tell us about your business once, describe your campaign in a few lines, and get a week-by-week plan with
            posts, scripts and images for the channels you already use.
          </p>
        </div>
        <span className="hidden text-sm text-on-header-muted wide:block">Made for small businesses without a marketing team.</span>
      </aside>
      <main className="flex items-center justify-center p-4 py-10 sm:p-8">{children}</main>
    </div>
  )
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(readAccountDeletedNotice)

  // Show the "account deleted" note once, then forget it.
  useEffect(() => {
    try {
      sessionStorage.removeItem(ACCOUNT_DELETED_KEY)
    } catch {
      // ignore
    }
  }, [])

  const switchMode = (next) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
        navigate('/', { replace: true })
      } else if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (err) throw err
        // Supabase returns a user with no identities when the email is already registered.
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('User already registered')
        }
        if (!data.session) navigate('/check-inbox', { replace: true, state: { email: email.trim() } })
        else navigate('/', { replace: true })
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (err) throw err
        setNotice('If there is an account for this email, we have sent a link to reset your password.')
      }
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const buttonLabel = { login: 'Log in', signup: 'Create account', forgot: 'Send reset link' }[mode]
  const busyLabel = { login: 'Logging in…', signup: 'Creating account…', forgot: 'Sending…' }[mode]

  return (
    <AuthShell>
      <div className="card w-full max-w-md p-6 sm:p-8">
        {mode === 'forgot' ? (
          <div className="mb-6">
            <h2 className="text-2xl">Reset your password</h2>
            <p className="mt-1 text-muted">Enter your email and we'll send you a link to choose a new password.</p>
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-week p-1" role="tablist" aria-label="Log in or sign up">
            {[
              ['login', 'Log in'],
              ['signup', 'Sign up'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => switchMode(key)}
                className={`min-h-11 rounded-lg text-sm font-bold transition-colors ${
                  mode === key ? 'bg-surface text-heading shadow-card' : 'text-muted hover:text-heading'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate={false}>
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
          />
          {mode !== 'forgot' && (
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              example={mode === 'signup' ? 'At least 6 characters.' : undefined}
              value={password}
              onChange={setPassword}
            />
          )}

          {error && <InlineError message={error} />}
          {notice && (
            <p className="rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn-accent w-full" disabled={busy}>
            {busy && <Spinner size={16} />}
            {busy ? busyLabel : buttonLabel}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === 'forgot' ? (
            <button type="button" className="link inline-flex min-h-11 items-center" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          ) : (
            <button type="button" className="link inline-flex min-h-11 items-center" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
