import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Field, InlineError, LoadingState, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { AuthShell } from './AuthPage'

export default function ResetPasswordPage() {
  const { user, loading, doneRecovering } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(err.message || "We couldn't update your password. Please try again.")
    doneRecovering()
    navigate('/', { replace: true })
  }

  if (loading) return <LoadingState />

  return (
    <AuthShell>
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h2 className="text-2xl">Choose a new password</h2>
        {user ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field
              id="new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              example="At least 6 characters."
              value={password}
              onChange={setPassword}
            />
            {error && <InlineError message={error} />}
            <button type="submit" className="btn-accent w-full" disabled={busy}>
              {busy && <Spinner size={16} />}
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        ) : (
          <>
            <p className="mt-2">This reset link has expired or was already used. Ask for a new one from the log in page.</p>
            <Link to="/login" className="btn-secondary mt-6 w-full">
              Back to log in
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}
