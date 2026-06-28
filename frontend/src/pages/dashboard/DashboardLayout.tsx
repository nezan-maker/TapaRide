import { useState } from 'react'
import { NavLink, Outlet, Link, useLocation, ScrollRestoration } from 'react-router-dom'
import Logo from '../../components/Logo'
import { cn } from '../../lib/utils'

import { useAuth } from '../../lib/auth'
import Fa from '../../components/Fa';

export default function DashboardLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()

  // Calculate real profile completion percentage
  const profileProgress = (() => {
    if (!user) return 0;
    const checks = [
      !!user.isVerified,
      !!user.phoneVerifiedAt,
      !!user.email,
      !!user.phone,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  })();

  const nav: Array<{ to: string; label: string; icon: string; end?: boolean }> = [
    { to: '/dashboard', label: 'Dashboard', icon: 'layoutdashboard', end: true },
  ]

  if (user?.role === 'CLIENT' || user?.role === 'ORGANIZATION') {
    nav.push(
      { to: '/dashboard/trips', label: 'My Trips', icon: 'ticket' },
      { to: '/dashboard/parcels', label: 'My Parcels', icon: 'package' },
      { to: '/dashboard/payments', label: 'Payment Methods', icon: 'creditcard' },
    )
  }

  nav.push(
    { to: '/dashboard/notifications', label: 'Notifications', icon: 'bell' },
    { to: '/dashboard/settings', label: 'Settings', icon: 'settingsicon' },
  )

  return (
    <div className="min-h-screen bg-mist">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white">
        <div className="flex h-16 items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100 lg:hidden"
              aria-label="menu"
            >
              {open ? <Fa name="x" className="h-5 w-5" /> : <Fa name="menu" className="h-5 w-5" />}
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink-100 text-ink-600 hover:bg-ink-50"
            >
              <Fa name="bell" className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-flame-600" />
            </Link>
            <div className="flex items-center gap-2">
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'default'}`}
                alt="avatar"
                className="h-9 w-9 rounded-full object-cover bg-ink-50"
              />
              <div className="hidden text-sm leading-tight sm:block">
                <div className="font-semibold text-ink-900">{user?.role || 'Guest'}</div>
                <div className="text-xs text-ink-400">{user?.email || 'email@taparide.onrender.com'}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6 sm:px-8">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-16 left-0 z-30 w-64 shrink-0 border-r border-ink-100 bg-white p-4 transition-transform lg:static lg:inset-auto lg:rounded-2xl lg:border lg:shadow-card',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          {/* Profile completion — calculated from real user data */}
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-800 p-4 text-white">
            <div className="text-sm font-semibold">Complete your profile</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-flame-500 transition-all duration-500"
                style={{ width: `${profileProgress}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-white/60">{profileProgress}% complete</div>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    isActive ? 'bg-ink-900 text-white shadow-soft' : 'text-ink-500 hover:bg-ink-50',
                  )
                }
              >
                <Fa name={item.icon} className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {(user?.role === 'CLIENT' || user?.role === 'ORGANIZATION') && (
            <Link
              to="/search"
              className="btn-flame mt-4 w-full"
            >
              <Fa name="plus" className="h-4 w-4" /> New Booking
            </Link>
          )}

          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-flame-600 hover:bg-flame-50 text-left"
          >
            <Fa name="sign-out-alt" className="h-4 w-4" /> Log Out
          </button>
        </aside>

        {open && (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-ink-950/30 lg:hidden"
          />
        )}

        <main className="min-w-0 flex-1" key={location.pathname}>
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  )
}
