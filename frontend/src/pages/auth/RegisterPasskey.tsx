import { useNavigate } from 'react-router-dom'
import { Fingerprint } from 'lucide-react'
import AuthLayout from './AuthLayout'
import PasskeyButton from '../../components/PasskeyButton'

export default function RegisterPasskey() {
  const navigate = useNavigate()

  const handlePasskeySuccess = () => {
    // Passkey successfully registered
    setTimeout(() => navigate('/dashboard'), 1000)
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
        <div className="rounded-2xl bg-ink-50 p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
              <Fingerprint className="h-5 w-5" />
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

        <div className="space-y-4">
          <PasskeyButton 
            mode="register" 
            onSuccess={handlePasskeySuccess}
          />

          <button
            onClick={handleSkip}
            className="btn-outline w-full py-3.5"
          >
            Skip for now
          </button>
        </div>

        <div className="flex items-center gap-2 text-center text-xs text-ink-400">
          <span className="h-px flex-1 bg-ink-100" />
          <span>You can add a passkey later in Settings</span>
          <span className="h-px flex-1 bg-ink-100" />
        </div>
      </div>
    </AuthLayout>
  )
}