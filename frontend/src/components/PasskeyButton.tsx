import { useState } from 'react'
import { Fingerprint, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  getPasskeyAuthOptions,
  authenticateWithPasskey,
  getPasskeyRegistrationOptions,
  registerPasskey,
} from '../lib/webauthn'

interface PasskeyButtonProps {
  mode: 'login' | 'register'
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
  className?: string
}

export default function PasskeyButton({ mode, onSuccess, onError, className }: PasskeyButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (mode === 'login') {
        const { error: optsError, options } = await getPasskeyAuthOptions()
        if (optsError || !options) {
          throw new Error(optsError || 'Failed to get authentication options')
        }

        const { error: authError, result } = await authenticateWithPasskey(options)
        if (authError || !result) {
          throw new Error(authError || 'Authentication failed')
        }

        setSuccess(true)
        onSuccess?.(result)
      } else {
        const { error: optsError, options } = await getPasskeyRegistrationOptions()
        if (optsError || !options) {
          throw new Error(optsError || 'Failed to get registration options')
        }

        const { error: regError, result } = await registerPasskey(options)
        if (regError || !result) {
          throw new Error(regError || 'Registration failed')
        }

        setSuccess(true)
        onSuccess?.(result)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          'btn-outline relative w-full py-3.5',
          isLoading && 'opacity-70 cursor-not-allowed',
          className
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{mode === 'login' ? 'Authenticating...' : 'Registering...'}</span>
          </>
        ) : success ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{mode === 'login' ? 'Authenticated!' : 'Registered!'}</span>
          </>
        ) : (
          <>
            <Fingerprint className="h-4 w-4" />
            <span>{mode === 'login' ? 'Use Passkey' : 'Add Passkey'}</span>
          </>
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && !isLoading && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            {mode === 'login' 
              ? 'Successfully authenticated with passkey!' 
              : 'Passkey successfully registered!'}
          </span>
        </div>
      )}
    </div>
  )
}