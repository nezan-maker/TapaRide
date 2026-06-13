import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, LayoutDashboard } from 'lucide-react'
import Logo from './Logo'
import { cn } from '../lib/utils'
import { useAuth } from '../lib/auth'

const links = [
  { to: '/search', label: 'Book a Trip' },
  { to: '/send-parcel', label: 'Send Parcel' },
  { to: '/track', label: 'Track' },
  { to: '/support', label: 'Support' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, loading } = useAuth()
  const isLoggedIn = !!user && !loading

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/70 bg-white/85 backdrop-blur-lg">
      <nav className="container-page flex h-16 items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn('nav-link', isActive && 'text-ink-900')
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {isLoggedIn ? (
            <>
              <Link to="/dashboard" className="btn-outline flex items-center gap-2 px-4 py-2.5">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <span className="text-sm text-ink-400 font-medium">
                {user?.email?.split('@')[0] || 'User'}
              </span>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Log In
              </Link>
              <Link to="/signup" className="btn-primary px-5 py-2.5">
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100 text-ink-900 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-ink-100 bg-white lg:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium',
                  location.pathname === l.to
                    ? 'bg-ink-50 text-ink-900'
                    : 'text-ink-600',
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-3">
              {isLoggedIn ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="btn-primary">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-outline">
                    Log In
                  </Link>
                  <Link to="/signup" onClick={() => setOpen(false)} className="btn-primary">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
