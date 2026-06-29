import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import AuthSpinner from '../../components/AuthSpinner'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import Fa from '../../components/Fa';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const prefillEmail = searchParams.get('email') || ''
  const prefillToken = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [email, setEmail] = useState(prefillEmail)
  const [token, setToken] = useState(prefillToken)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !token || password.length < 8) {
      setError('Please fill in all fields with a valid password (min 8 chars).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/accept-invite', { email, token, password })
      // Store tokens from the session response
      if (res.accessToken) localStorage.setItem('accessToken', res.accessToken)
      if (res.refreshToken) localStorage.setItem('refreshToken', res.refreshToken)
      setDone(true)
      await refreshUser()
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invitation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={done ? 'Welcome aboard!' : 'Accept your invitation'}
      subtitle={
        done
          ? 'Your account is ready. Redirecting you to the dashboard…'
          : 'You\'ve been invited to join a TapaRide team. Set your password to get started.'
      }
      footer={
        done ? null : (
          <Link to="/login" className="text-sm font-semibold text-flame-600">
            Already have an account? Log in
          </Link>
        )
      }
    >
      {done ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
          <Fa name="check-circle2" className="h-6 w-6 shrink-0" />
          <p className="text-sm">Account created! Taking you to your dashboard…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
              <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="label">Email address</label>
            <div className="relative">
              <Fa name="mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !!prefillEmail}
                autoFocus={!prefillEmail}
              />
            </div>
          </div>

          <div>
            <label className="label">Invitation code</label>
            <div className="relative">
              <Fa name="key" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9 font-mono"
                placeholder="Paste your invitation code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading || !!prefillToken}
                autoFocus={!!prefillEmail}
              />
            </div>
            {!prefillToken && (
              <p className="mt-1.5 text-xs text-ink-400">
                Check your email — the invitation code was sent along with the invite link.
              </p>
            )}
          </div>

          <div>
            <label className="label">Choose a password</label>
            <div className="relative">
              <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type={show ? 'text' : 'password'}
                className="input pl-9 pr-10"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
                aria-label="toggle password"
              >
                {show ? <Fa name="eyeoff" className="h-4 w-4" /> : <Fa name="eye" className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {loading ? <AuthSpinner label="Setting up…" /> : 'Accept & Join'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
