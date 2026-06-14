import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import Stepper from '../components/Stepper'
import { cn } from '../lib/utils'
import { api, ApiError } from '../lib/api'
import Fa from '../components/Fa';

const steps = ['Complete Profile', 'Agency Verification', 'RURA Registration'] as const;

interface OnboardingData {
  agencyName: string;
  ruraCode: string;
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const [data, setData] = useState<OnboardingData>({ agencyName: '', ruraCode: '' })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const canAdvance =
    (step === 0) ||                              // profile is optional polish
    (step === 1 && data.agencyName.trim().length >= 2) ||
    (step === 2 && data.ruraCode.trim().length >= 1)

  const onSubmitFinal = async () => {
    if (!data.agencyName.trim() || !data.ruraCode.trim()) {
      setError('Please fill in your agency name and RURA code.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Real backend: POST /api/agencies — name + ruraCode.
      // The backend calls the (mock) RURA provider to verify the code; if it
      // starts with "RURA-", it's accepted. See
      // backend/src/modules/agencies/agencies.service.ts
      const res = await api.post('/api/agencies', {
        name: data.agencyName.trim(),
        ruraCode: data.ruraCode.trim(),
      })
      setDone(true)
      // Brief celebratory moment, then route into the dashboard
      setTimeout(() => navigate('/dashboard'), 1500)
      // surface the id to avoid "unused" lint in case the API shape changes
      void (res as { id?: string }).id
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register agency')
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (!canAdvance) return
    if (step < steps.length - 1) {
      setStep((s) => s + 1)
    } else {
      onSubmitFinal()
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-mist">
        <header className="border-b border-ink-100 bg-white">
          <div className="container-page flex items-center justify-between py-4">
            <Logo />
            <span className="eyebrow">Onboarding & Verification</span>
          </div>
        </header>
        <div className="container-page py-20">
          <div className="mx-auto max-w-md text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Fa name="check-circle2" className="h-10 w-10" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold text-ink-900">You're in.</h1>
            <p className="mt-2 text-ink-500">
              {data.agencyName} is registered and ready to operate on Tapa. Redirecting you to your dashboard…
            </p>
            <div className="mt-6 h-1 w-32 mx-auto overflow-hidden rounded-full bg-ink-100">
              <div className="h-full w-1/3 animate-pulse bg-flame-600" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b border-ink-100 bg-white">
        <div className="container-page flex items-center justify-between py-4">
          <Logo />
          <span className="eyebrow">Onboarding & Verification</span>
        </div>
      </header>

      <div className="border-b border-ink-100 bg-white py-5">
        <div className="container-page">
          <Stepper steps={[...steps]} current={step} />
        </div>
      </div>

      <div className="container-page py-10">
        <div className="mx-auto max-w-xl">
          {step === 0 && <CompleteProfile />}
          {step === 1 && (
            <AgencyVerification
              value={data.agencyName}
              onChange={(v) => setData((d) => ({ ...d, agencyName: v }))}
            />
          )}
          {step === 2 && (
            <RuraRegistration
              agencyName={data.agencyName}
              ruraCode={data.ruraCode}
              onChange={(v) => setData((d) => ({ ...d, ruraCode: v }))}
            />
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
              <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => { setStep((s) => s - 1); setError(null) }}
                disabled={submitting}
                className="btn-ghost"
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={next}
              disabled={!canAdvance || submitting}
              className="btn-primary disabled:opacity-50"
            >
              {submitting
                ? 'Submitting…'
                : step === steps.length - 1
                ? 'Submit Application'
                : 'Save & Continue'}
              <Fa name="arrow-right" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm font-semibold text-ink-400 hover:text-ink-900"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompleteProfile() {
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink-900">Complete Profile</h1>
        <span className="chip bg-ink-50 text-ink-500">Step 1 of 3</span>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="relative">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-ink-50 text-ink-300">
            <Fa name="camera" className="h-8 w-8" />
          </div>
          <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-ink-900 text-white">
            <Fa name="camera" className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-400">Upload profile photo (optional)</p>
      </div>

      <div className="mt-6 grid gap-4">
        <div>
          <label className="label">Date of birth</label>
          <input type="date" className="input" />
        </div>
        <div>
          <label className="label">National ID / Passport number</label>
          <input className="input" placeholder="1 1990 8 0054321 0 54" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 p-5 text-white">
        <div className="text-xs font-bold uppercase tracking-wide text-white/60">What you'll unlock</div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
          {[
            { icon: 'wallet', label: 'Wallet' },
            { icon: 'bus',    label: 'Booking' },
            { icon: 'package',label: 'Parcels' },
          ].map((f) => (
            <div key={f.label} className="rounded-xl bg-white/10 p-3">
              <Fa name={f.icon} className="mx-auto h-5 w-5" />
              <div className="mt-1.5 font-semibold">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgencyVerification({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink-900">
        <Fa name="shield" className="h-5 w-5 text-ink-700" /> Agency Details
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Tell us the legal name of the agency you operate. This is what riders will see when booking.
      </p>

      <div className="mt-5">
        <label className="label">Agency name</label>
        <input
          className="input"
          placeholder="e.g. Rwanda Express Lines"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      </div>

      <button
        type="button"
        className="mt-6 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/40 p-8 text-center transition hover:border-ink-400"
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-900 text-white">
          <Fa name="cloud-arrow-up" className="h-5 w-5" />
        </span>
        <span className="font-semibold text-ink-900">Click to upload operating license</span>
        <span className="text-xs text-ink-400">PDF, JPG or PNG (max. 10MB)</span>
      </button>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Fa name="clock" className="h-5 w-5 text-amber-500" />
        <div>
          <div className="text-sm font-semibold text-ink-900">Verification Pending</div>
          <div className="text-xs text-ink-400">Usually takes 24 hours</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
        <Fa name="lock" className="h-4 w-4" /> Documents are encrypted and stored securely.
      </div>
    </div>
  )
}

function RuraRegistration({
  agencyName,
  ruraCode,
  onChange,
}: {
  agencyName: string;
  ruraCode: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-extrabold text-ink-900">RURA Registration</h1>
      <p className="mt-1 text-sm text-ink-500">
        Final step — verify {agencyName ? <strong>{agencyName}</strong> : 'your agency'} with RURA.
      </p>

      <div className="mt-4 rounded-xl bg-ink-900 p-4 text-sm text-white/80">
        The <span className="font-semibold text-white">RURA Transport Code</span> is issued by the Rwanda
        Utilities Regulatory Authority. It is required for all legal transport operations.
      </div>

      <div className="mt-5">
        <label className="label">Enter RURA code</label>
        <input
          className="input"
          placeholder="RURA-10293847"
          value={ruraCode}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <p className="mt-1.5 text-xs text-ink-400">
          In dev mode any code starting with <code className="rounded bg-ink-50 px-1.5 py-0.5">RURA-</code> is accepted.
        </p>
      </div>

      <div className="mt-6">
        <div className="label">Required license documents</div>
        <div className="space-y-3">
          <DocRow name="Transport_License.pdf" meta="2.4 MB · Uploaded" uploaded />
          <DocRow name="Insurance Certificate" meta="Tap to upload" />
        </div>
      </div>
    </div>
  )
}

function DocRow({ name, meta, uploaded }: { name: string; meta: string; uploaded?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3',
        uploaded ? 'border-ink-100 bg-white' : 'border-dashed border-ink-200 bg-ink-50/40',
      )}
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-flame-50 text-flame-600">
        <Fa name="file-lines" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900">{name}</div>
        <div className="text-xs text-ink-400">{meta}</div>
      </div>
      {uploaded ? (
        <Fa name="check-circle2" className="h-5 w-5 text-emerald-500" />
      ) : (
        <Fa name="plus" className="h-5 w-5 text-ink-400" />
      )}
    </div>
  )
}
