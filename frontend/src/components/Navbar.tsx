import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Logo from './Logo'
import { cn } from '../lib/utils'
import { useAuth, type Role } from '../lib/auth'
import Fa from './Fa';
import ProtectedLink from './ProtectedLink';

/**
 * Each navbar link has:
 *   - `roles`: which logged-in roles see this link (empty = visible to all when logged out)
 *   - `protected`: whether the link redirects to /login when clicked while logged out
 *
 * When the user is **logged out**, all links without explicit role restrictions
 * are shown as marketing — protected links will gate themselves via `<ProtectedLink>`.
 * When the user is **logged in**, only their role-appropriate links appear.
 */
const links: { to: string; label: string; roles?: Role[]; protected?: boolean }[] = [
  {
    to: '/search',
    label: 'Book a Trip',
    roles: ['CLIENT'],
  },
  {
    to: '/send-parcel',
    label: 'Send Parcel',
    roles: ['CLIENT'],
    protected: true,
  },
  {
    to: '/track',
    label: 'Track',
    // visible to all authenticated users; also visible when logged out (marketing)
  },
  {
    to: '/support',
    label: 'Support',
  },
];

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, loading } = useAuth()
  const isLoggedIn = !!user && !loading

  // Filter links by role when the user is logged in; show all when logged out.
  const visible = isLoggedIn
    ? links.filter((l) => !l.roles || l.roles.includes(user!.role))
    : links

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/70 bg-white/85 backdrop-blur-lg">
      <nav className="container-page flex h-16 items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-8 lg:flex">
          {visible.map((l) =>
            l.protected ? (
              <ProtectedLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={cn('nav-link', location.pathname === l.to && 'text-ink-900')}
              >
                {l.label}
              </ProtectedLink>
            ) : (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn('nav-link', isActive && 'text-ink-900')
                }
              >
                {l.label}
              </NavLink>
            ),
          )}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {isLoggedIn ? (
            <>
              <Link to="/dashboard" className="btn-outline flex items-center gap-2 px-4 py-2.5">
                <Fa name="layout-dashboard" className="h-4 w-4" />
                Dashboard
              </Link>
              <span className="hidden text-sm font-medium text-ink-400 sm:block">
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
          {open ? <Fa name="x" className="h-5 w-5" /> : <Fa name="menu" className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-ink-100 bg-white lg:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {visible.map((l) =>
              l.protected ? (
                <ProtectedLink
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
                </ProtectedLink>
              ) : (
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
              ),
            )}
            <div className="mt-2 grid grid-cols-2 gap-3">
              {isLoggedIn ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="btn-primary">
                    <Fa name="layout-dashboard" className="h-4 w-4" /> Dashboard
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
