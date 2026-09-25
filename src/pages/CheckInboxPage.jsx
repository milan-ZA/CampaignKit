import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import { AuthShell } from './AuthPage'

export default function CheckInboxPage() {
  const email = useLocation().state?.email
  return (
    <AuthShell>
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-link-soft text-link">
          <Icon name="send" size={26} />
        </span>
        <h2 className="mt-5 text-2xl">Check your inbox to confirm your email</h2>
        <p className="mt-2 text-body">
          We sent a confirmation link{email ? <> to <strong className="text-heading">{email}</strong></> : ''}. Click it,
          then come back and log in.
        </p>
        <Link to="/login" className="btn-secondary mt-6 w-full">
          Back to log in
        </Link>
      </div>
    </AuthShell>
  )
}
