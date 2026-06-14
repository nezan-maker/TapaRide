import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import PasskeyButton from '../../components/PasskeyButton'
import Fa from '../../components/Fa';

export default function RegisterPasskey() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handlePasskeySuccess = () => {
    setError(null)
    setTimeout(() => navigate('/dashboard'), 1000)
  }

  const handlePasskeyError = (err: string) => {
    setError(err)
  }

  const handleSkip = () => {
    navigate('/dashboard')
  }

  return (
    <AuthLayout
      title="Set up a passkey"
      subtitle="Add a passkey for secure, passwordless access to your account."
      footer={<></>}
    >
      <div className="space-y-6">
        {/* Explainer card */}
        <div className="rounded-2xl bg-ink-50 p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
              <Fa name="fingerprint" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-ink-900">What is a passkey?</h3>
              <p className="mt-1 text-sm text-ink-600">
                A passkey lets you sign in using your face, fingerprint, or device PIN instead of a password.
                It's more secure and never shared with any website.
              </p>
            </div>
          </div>
        </div>

        {/* Error banner — surfaced from PasskeyButton + page-level context */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-flame-50 border border-flame-200 p-4">
            <Fa name="alert-circle" className="h-5 w-5 shrink-0 text-flame-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-flame-800">Couldn't set up passkey</div>
              <p className="mt-0.5 text-sm text-flame-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-flame-400 hover:text-flame-600"
              aria-label="Dismiss"
            >
              <Fa name="x" className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Action area */}
        <div className="space-y-4">
          <PasskeyButton
            mode="register"
            onSuccess={handlePasskeySuccess}
            onError={handlePasskeyError}
          />

          <button
            onClick={handleSkip}
            className="btn-outline w-full py-3.5"
          >
            Skip for now
          </button>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-4">
          <Fa name="lock" className="h-5 w-5 shrink-0 text-ink-400 mt-0.5" />
          <p className="text-xs text-ink-500">
            Your passkey is stored securely on your device and is never sent to our servers.
            You can add or remove passkeys at any time from Settings → Security.
          </p>
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-2 text-center text-xs text-ink-400">
          <span className="h-px flex-1 bg-ink-100" />
          <span>You can add a passkey later in Settings</span>
          <span className="h-px flex-1 bg-ink-100" />
        </div>
      </div>
    </AuthLayout>
  )
}
