import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout, { AuthLink } from './AuthLayout'
import { api, ApiError } from '../../lib/api'
import Fa from '../../components/Fa';

export default function ForgotPassword() {
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) {
      setError('Please enter your phone number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/forgot-password', {
        phone: phone.startsWith('+') ? phone : `+${phone}`,
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reset code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={sent ? 'Check your phone' : 'Reset your password'}
      subtitle={
        sent
          ? "We've sent a 6-digit OTP to your phone. It expires in 10 minutes."
          : "Enter your phone number and we'll send you a code to reset your password."
      }
      footer={<>Remembered it? <AuthLink to="/login">Back to login</AuthLink></>}
    >
      {sent ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
            <Fa name="check-circle2" className="h-6 w-6 shrink-0" />
            <p className="text-sm">Reset code sent successfully. Check your SMS messages.</p>
          </div>
          <Link to="/login" className="btn-outline w-full">
            <Fa name="arrow-left" className="h-4 w-4" /> Back to login
          </Link>
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
            <label className="label">Phone number</label>
            <div className="relative">
              <Fa name="phone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="+250 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
