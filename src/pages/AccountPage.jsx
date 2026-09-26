import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { InlineError, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { useTheme } from '../context/ThemeContext'
import { ACCOUNT_DELETED_KEY, callFunction } from '../lib/api'
import { formatTimestamp } from '../lib/dates'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD = 6

function Section({ title, description, children }) {
  return (
    <section className="card p-5 sm:p-7">
      <h2 className="text-lg">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function friendlyPasswordError(error) {
  const msg = error?.message ?? ''
  if (/different from the old|same_password/i.test(`${error?.code} ${msg}`)) {
    return 'Your new password must be different from your current one.'
  }
  if (/reauthenticat|recent login|nonce/i.test(msg)) {
    return 'For your security, please log out, log in again, and then change your password.'
  }
  if (/weak|at least|characters/i.test(msg)) return `Please use a password with at least ${MIN_PASSWORD} characters.`
  if (/fetch|network/i.test(msg)) return "We couldn't reach the server. Check your connection and try again."
  return "We couldn't change your password. Please try again."
}

function PasswordForm() {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const mismatch = repeat.length > 0 && repeat !== password
  const canSave = password.length >= MIN_PASSWORD && repeat === password && !busy

  const submit = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError(null)
    setDone(false)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(friendlyPasswordError(err))
    setPassword('')
    setRepeat('')
    setDone(true)
  }

  const type = show ? 'text' : 'password'
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-password" className="label">
            New password
          </label>
          <input
            id="new-password"
            type={type}
            autoComplete="new-password"
            className="input mt-1.5"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setDone(false)
            }}
          />
          <p className={`hint ${tooShort ? 'font-medium text-error' : ''}`}>At least {MIN_PASSWORD} characters.</p>
        </div>
        <div>
          <label htmlFor="repeat-password" className="label">
            Type it again
          </label>
          <input
            id="repeat-password"
            type={type}
            autoComplete="new-password"
            className="input mt-1.5"
            value={repeat}
            onChange={(e) => {
              setRepeat(e.target.value)
              setDone(false)
            }}
          />
          {mismatch && <p className="hint font-medium text-error">The two passwords don't match.</p>}
        </div>
      </div>

      <div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-body">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-(--c-link)" />
          Show passwords
        </label>
      </div>

      {error && <InlineError message={error} />}
      {done && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success" role="status">
          <Icon name="check" size={16} /> Password updated. Use it next time you log in.
        </p>
      )}

      <button type="submit" className="btn-secondary" disabled={!canSave}>
        {busy ? <Spinner size={16} /> : <Icon name="lock" size={16} />}
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

function Usage() {
  const [counts, setCounts] = useState(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setCounts(null)
    // Row Level Security limits every count to the signed-in user's own rows.
    const count = (table) => supabase.from(table).select('id', { count: 'exact', head: true })
    const results = await Promise.all([count('campaigns'), count('campaign_items'), count('campaign_item_images')])
    if (results.some((r) => r.error)) return setError(true)
    setCounts(results.map((r) => r.count ?? 0))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <InlineError message="We couldn't load your usage." onRetry={load} />
  const tiles = [
    ['Campaigns', counts?.[0]],
    ['Posts', counts?.[1]],
    ['AI images', counts?.[2]],
  ]
  return (
    <>
      <dl className="grid grid-cols-3 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-week p-4">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-extrabold text-heading tabular-nums">
              {value ?? <Spinner size={18} className="text-muted" />}
            </dd>
          </div>
        ))}
      </dl>
      <p className="hint mt-3">Plans and scripts cost well under a cent each; a set of 3 images costs a few cents.</p>
    </>
  )
}

const CONFIRM_WORD = 'DELETE'

function DeleteAccount() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setTyped('')
    setError(null)
  }

  const remove = async (e) => {
    e.preventDefault()
    if (typed !== CONFIRM_WORD || busy) return
    setBusy(true)
    setError(null)
    try {
      await callFunction('delete-account', { confirm: typed })
    } catch (err) {
      setBusy(false)
      return setError(err.message)
    }
    // The login no longer exists; clear it from this browser. The login page shows a goodbye note.
    try {
      sessionStorage.setItem(ACCOUNT_DELETED_KEY, '1')
    } catch {
      // Private mode: the user just won't see the note.
    }
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/login', { replace: true })
  }

  return (
    <>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-body">
        <li>Your login, brand profile and logo</li>
        <li>All your campaigns and posts</li>
        <li>All AI images you created</li>
      </ul>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        <Icon name="trash" size={16} /> Delete my account
      </button>

      {open && (
        <Modal onClose={close} labelledBy="delete-title" width={440} role="alertdialog">
          <form onSubmit={remove} className="p-6">
            <h2 id="delete-title" className="text-lg">
              Delete your account for good?
            </h2>
            <p className="mt-2 text-body">
              This permanently deletes your login and everything you created in CampaignKit. You can't undo this.
            </p>
            <label htmlFor="confirm-delete" className="label mt-5">
              Type {CONFIRM_WORD} to confirm
            </label>
            <input
              id="confirm-delete"
              className="input mt-1.5"
              autoComplete="off"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              disabled={busy}
            />
            {error && (
              <div className="mt-3">
                <InlineError message={error} />
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-danger" disabled={typed !== CONFIRM_WORD || busy}>
                {busy ? <Spinner size={16} /> : <Icon name="trash" size={16} />}
                {busy ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

export default function AccountPage() {
  const { user } = useAuth()
  const { preference, setPreference } = useTheme()
  const confirm = useConfirm()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(null)

  const signOutEverywhere = async () => {
    const ok = await confirm({
      title: 'Log out on all devices?',
      message: 'You will be logged out here and on every other phone, tablet or computer where you are logged in.',
      confirmLabel: 'Log out everywhere',
    })
    if (!ok) return
    setSigningOut(true)
    setSignOutError(null)
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) {
      setSigningOut(false)
      setSignOutError("We couldn't log you out everywhere. Please try again.")
    }
    // On success the auth listener clears the session and the app returns to the login page.
  }

  const themeOptions = [
    ['light', 'Light', 'sun'],
    ['dark', 'Dark', 'moon'],
    ['system', 'Same as my device', 'settings'],
  ]

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl">Account settings</h1>
        <p className="mt-1 text-body">
          Your login and app settings. Your business details and channels live in your{' '}
          <Link to="/brand" className="link">
            Brand profile
          </Link>
          .
        </p>
      </div>

      <Section title="Your account">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="sm:col-span-3">
            <dt className="text-muted">Email</dt>
            <dd className="mt-0.5 font-semibold break-all text-heading">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-muted">Member since</dt>
            <dd className="mt-0.5 font-semibold text-heading">{user?.created_at ? formatTimestamp(user.created_at) : '–'}</dd>
          </div>
          <div>
            <dt className="text-muted">Last login</dt>
            <dd className="mt-0.5 font-semibold text-heading">
              {user?.last_sign_in_at ? formatTimestamp(user.last_sign_in_at) : '–'}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Change password" description="Choose a new password for logging in to CampaignKit.">
        <PasswordForm />
      </Section>

      <Section title="Appearance" description="How CampaignKit looks on this device.">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Appearance">
          {themeOptions.map(([value, label, icon]) => {
            const on = preference === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPreference(value)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  on ? 'border-link bg-link-soft text-link' : 'border-input bg-surface text-body hover:bg-hover'
                }`}
              >
                <Icon name={icon} size={16} /> {label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Your usage" description="Everything you've created so far.">
        <Usage />
      </Section>

      <Section title="Log out everywhere" description="Useful if you logged in on a shared or lost device.">
        {signOutError && (
          <div className="mb-3">
            <InlineError message={signOutError} />
          </div>
        )}
        <button type="button" className="btn-secondary" onClick={signOutEverywhere} disabled={signingOut}>
          {signingOut ? <Spinner size={16} /> : <Icon name="logout" size={16} />}
          Log out on all devices
        </button>
      </Section>

      <Section title="Delete my account" description="Permanently removes your account and everything in it.">
        <DeleteAccount />
      </Section>
    </main>
  )
}
