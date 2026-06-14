import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { api, ApiError } from '../../lib/api'
import Fa from '../../components/Fa';

type Stage = 'request' | 'verify';

/**
 * Two-step password reset:
 *   1. Enter phone → POST /api/auth/forgot-password (sends 6-digit OTP via SMS)
 *   2. Enter OTP + new password → POST /api/auth/reset-password
 *
 * The backend's resetPasswordSchema requires a strong password
 * (8+ chars, mixed case, digit). We mirror those rules on the client so
 * the user sees the requirements before submitting.
 */
export default function ForgotPassword() {
  const [stage, setStage] = useState<Stage>('request')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordIssues = checkPasswordStrength(newPassword)

  const requestCode = async (e: React.FormEvent) => {
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
      setStage('verify')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reset code.')
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your SMS.')
      return
    }
    if (passwordIssues.length > 0) {
      setError(passwordIssues[0])
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/reset-password', {
        phone: phone.startsWith('+') ? phone : `+${phone}`,
        code,
        newPassword,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={
        done ? 'Password updated' :
        stage === 'verify' ? 'Set a new password' :
        'Reset your password'
      }
      subtitle={
        done
          ? 'Your password is set. Log in with the new password to continue.'
          : stage === 'verify'
          ? `We sent a 6-digit code to ${phone}. Enter it below with your new password.`
          : "Enter your phone number and we'll send you a code to reset your password."
      }
      footer={<><Link to="/login" className="text-sm font-semibold text-flame-600">Back to login</Link></>}
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
            <Fa name="check-circle2" className="h-6 w-6 shrink-0" />
            <p className="text-sm">Your password has been updated successfully.</p>
          </div>
          <Link to="/login" className="btn-primary w-full">
            Continue to login <Fa name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
      ) : stage === 'request' ? (
        <form onSubmit={requestCode} className="space-y-4">
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
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Reset Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-4">
          <div>
            <label className="label">6-digit code</label>
            <input
              className="input text-center text-2xl tracking-[0.5em] font-mono"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="label">New password</label>
            <div className="relative">
              <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type={show ? 'text' : 'password'}
                className="input px-9"
                placeholder="Choose a strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            <ul className="mt-2 space-y-0.5 text-xs">
              <Rule ok={newPassword.length >= 8} label="At least 8 characters" />
              <Rule ok={/[A-Z]/.test(newPassword)} label="One uppercase letter" />
              <Rule ok={/[a-z]/.test(newPassword)} label="One lowercase letter" />
              <Rule ok={/[0-9]/.test(newPassword)} label="One number" />
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStage('request'); setCode(''); setNewPassword(''); setError(null) }}
              className="btn-outline flex-1 py-3"
            >
              <Fa name="arrow-left" className="h-4 w-4" /> Back
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 6 || passwordIssues.length > 0}
              className="btn-primary flex-1 py-3 disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}

function checkPasswordStrength(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(pw)) issues.push('Password must contain at least one uppercase letter.');
  if (!/[a-z]/.test(pw)) issues.push('Password must contain at least one lowercase letter.');
  if (!/[0-9]/.test(pw)) issues.push('Password must contain at least one number.');
  return issues;
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-ink-400'}`}>
      <Fa name={ok ? 'check' : 'circle'} className="h-3 w-3" />
      <span>{label}</span>
    </li>
  );
}
