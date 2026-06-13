import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Package, User, MapPin, Phone, StickyNote, Plus, Minus, AlertCircle } from 'lucide-react'
import { rwf } from '../lib/utils'
import { api, ApiError } from '../lib/api'

export default function SendParcel() {
  const [searchParams] = useSearchParams()
  const initialFrom = searchParams.get('from') || ''
  const initialTo = searchParams.get('to') || ''

  const [stations, setStations] = useState<string[]>([])
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [weight, setWeight] = useState(1)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchStations()
  }, [])

  const fetchStations = async () => {
    try {
      const data = await api.get('/api/stations')
      const list = data.stations || data.items || data
      const names = Array.isArray(list) ? list.map((s: any) => s.name || s) : []
      setStations(names.length > 0 ? names : ['Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)', 'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi'])
    } catch {
      setStations(['Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)', 'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi'])
    } finally {
      setLoading(false)
    }
  }

  const availableFrom = stations.filter((s) => s !== to)
  const availableTo = stations.filter((s) => s !== from)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to || !receiverName || !receiverPhone) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.post('/api/parcels', {
        receiverName,
        receiverPhone,
        fromStation: from,
        toStation: to,
        weight,
        notes: note || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send parcel')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-mist py-16">
        <div className="container-page mx-auto max-w-lg text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Package className="h-8 w-8" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold text-ink-900">Parcel Submitted!</h2>
          <p className="mt-2 text-ink-500">
            Your parcel from {from} to {to} has been registered and is ready for pickup.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link to="/dashboard/parcels" className="btn-primary">Track Parcel</Link>
            <button onClick={() => setSuccess(false)} className="btn-outline">Send Another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-mist py-8 sm:py-12">
      <div className="container-page mx-auto max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">Send a Parcel</h1>
          <p className="mt-1 text-ink-500">Ship items between cities with Tapa's trusted network.</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">From</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  className="input pl-9"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={loading || submitting}
                >
                  <option value="">Select city</option>
                  {availableFrom.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">To</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  className="input pl-9"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={loading || submitting}
                >
                  <option value="">Select city</option>
                  {availableTo.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Receiver name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="e.g. Jean Paul"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="label">Receiver phone</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="+250 7XX XXX XXX"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="label">Weight (kg)</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWeight(Math.max(0.5, weight - 0.5))}
                className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100"
                disabled={submitting}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-16 text-center text-lg font-extrabold text-ink-900">{weight}</span>
              <button
                type="button"
                onClick={() => setWeight(Math.min(50, weight + 0.5))}
                className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100"
                disabled={submitting}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <div className="relative">
              <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" />
              <textarea
                className="input pl-9 pt-3 min-h-[80px] resize-none"
                placeholder="Fragile, handle with care..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="rounded-xl bg-ink-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Estimated fee</span>
              <span className="text-lg font-extrabold text-ink-900">{rwf(weight * 2000)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-400">Based on 2,000 RWF/kg — final price may vary.</p>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="btn-primary w-full py-3.5 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Send Parcel'}
          </button>
        </form>
      </div>
    </div>
  )
}
