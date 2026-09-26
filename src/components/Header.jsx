import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import AccountMenu from './AccountMenu'
import Icon from './Icon'
import { Logo } from './ui'

const TABS = [
  { to: '/brand', label: 'Brand profile', match: (p) => p.startsWith('/brand') },
  { to: '/', label: 'Campaigns', match: (p) => p === '/' || p.startsWith('/campaigns') },
]

export default function Header() {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => setMenuOpen(false), [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 bg-header text-on-header">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="rounded-lg" aria-label="CampaignKit home">
          <Logo onDark />
        </Link>

        <nav className="ml-6 hidden h-full items-stretch gap-1 wide:flex" aria-label="Main">
          {TABS.map((tab) => {
            const active = tab.match(pathname)
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center border-b-[3px] px-3 pt-[3px] text-sm font-semibold transition-colors ${
                  active
                    ? 'border-accent text-on-header'
                    : 'border-transparent text-on-header-muted hover:text-on-header'
                }`}
              >
                {tab.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-on-header-muted hover:text-on-header"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <AccountMenu />

          <div className="relative wide:hidden" ref={menuRef}>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg text-on-header"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} />
            </button>
            {menuOpen && (
              <nav
                aria-label="Main"
                className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-pop"
              >
                {TABS.map((tab) => {
                  const active = tab.match(pathname)
                  return (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center border-l-[3px] px-4 text-sm font-semibold ${
                        active ? 'border-accent bg-hover text-heading' : 'border-transparent text-body hover:bg-hover'
                      }`}
                    >
                      {tab.label}
                    </NavLink>
                  )
                })}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
