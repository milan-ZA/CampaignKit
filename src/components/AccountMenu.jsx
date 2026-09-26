import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from './Icon'

/** Round button with the user's initial; opens a menu with their email, Account settings and Log out. */
export default function AccountMenu() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const email = user?.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-11 items-center justify-center rounded-lg"
      >
        <span
          className={`flex size-9 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-on-accent ${
            pathname.startsWith('/account') ? 'ring-2 ring-on-header' : ''
          }`}
          aria-hidden="true"
        >
          {initial}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-64 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-pop"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="truncate text-sm font-semibold text-heading" title={email}>
              {email}
            </p>
          </div>
          <Link
            to="/account"
            role="menuitem"
            className="flex min-h-11 items-center gap-2.5 px-4 text-sm font-semibold text-body hover:bg-hover"
          >
            <Icon name="settings" size={18} /> Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm font-semibold text-body hover:bg-hover"
          >
            <Icon name="logout" size={18} /> Log out
          </button>
        </div>
      )}
    </div>
  )
}
