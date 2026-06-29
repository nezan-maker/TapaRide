import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout, { AuthLink } from './AuthLayout';
import AuthSpinner from '../../components/AuthSpinner';
import { api, ApiError } from '../../lib/api'
import Fa from '../../components/Fa';

export default function Otp() {
  const navigate = useNavigate()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handle = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Phone is stored in sessionStorage after registration
      const phone = sessionStorage.getItem('registrationPhone') || ''
      await api.post('/api/auth/verify-otp', { phone, code })
      // Phone verified — go to onboarding, which ends at login
      // (email verification happens via a link sent to the user's inbox)
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Verify your number"
      subtitle="Enter the 6-digit code we sent to your phone."
      footer={<>Entered the wrong number? <AuthLink to="/signup">Go back</AuthLink></>}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el }}
              value={d}
              onChange={(e) => handle(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
              }}
              inputMode="numeric"
              maxLength={1}
              disabled={loading}
              className="h-14 w-12 rounded-xl border border-ink-100 text-center text-2xl font-bold text-ink-900 outline-none focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10 disabled:opacity-50"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || digits.join('').length !== 6}
          className="btn-primary w-full py-3.5 disabled:opacity-50"
        >
          {loading ? <AuthSpinner label="Verifying…" /> : 'Verify'}
        </button>

        <p className="text-center text-sm text-ink-500">
          Didn't get the code?{' '}
          <button type="button" className="font-semibold text-flame-600" disabled={loading}>
            Resend code
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
