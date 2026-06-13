import { useState } from 'react'
import { cn } from '../lib/utils'
import { api, ApiError } from '../lib/api'
import Fa from '../components/Fa';

interface ParcelTrackingInfo {
  id: string
  trackingCode: string
  receiverName: string
  status: string
  createdAt: string
  journey?: {
    sourceStation?: { name: string }
    destinationStation?: { name: string }
  }
  timeline?: Array<{
    label: string
    place: string
    time: string
    done: boolean
  }>
}

export default function Track() {
  const [code, setCode] = useState('')
  const [shown, setShown] = useState(false)
  const [tracking, setTracking] = useState<ParcelTrackingInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/api/parcels/track/${encodeURIComponent(code.trim())}`)
      setTracking(data.parcel || data)
      setShown(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to track parcel')
      setShown(true)
    } finally {
      setLoading(false)
    }
  }

  const defaultTimeline = [
    { label: 'Order Placed', place: 'Online', time: new Date().toLocaleDateString(), done: true },
    { label: 'Picked Up', place: 'Kigali — Nyabugogo', time: new Date().toLocaleDateString(), done: true },
    { label: 'In Transit', place: 'En route', time: '—', done: false },
    { label: 'Delivered', place: 'Destination', time: '—', done: false },
  ]

  const timeline = tracking?.timeline || defaultTimeline

  return (
    <div className="bg-mist">
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-16 text-white">
        <div className="container-page mx-auto max-w-2xl text-center">
          <span className="grid mx-auto mb-4 h-14 w-14 place-items-center rounded-2xl bg-white/10">
            <Fa name="package" className="h-6 w-6" />
          </span>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Track your parcel</h1>
          <p className="mt-2 text-white/70">
            Enter your tracking code to see your parcel's live location and status.
          </p>
          <form
            onSubmit={handleTrack}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Fa name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. TR-9K2L-88X"
                className="w-full rounded-xl border border-transparent bg-white py-4 pl-12 pr-4 text-ink-900 outline-none placeholder:text-ink-300"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-flame px-7 py-4 text-base disabled:opacity-50"
            >
              {loading ? 'Tracking...' : 'Track'}
            </button>
          </form>
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-flame-500/20 px-4 py-3 text-sm text-white">
              <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      <div className="container-page py-12">
        {shown && tracking ? (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-5">
                <div>
                  <div className="text-sm text-ink-400">Tracking code</div>
                  <div className="text-lg font-extrabold text-ink-900">{tracking.trackingCode}</div>
                </div>
                <span className="chip bg-flame-100 text-flame-700">
                  {tracking.status === 'PENDING' ? 'Pending Pickup'
                    : tracking.status === 'IN_TRANSIT' ? 'In Transit'
                    : tracking.status === 'DELIVERED' ? 'Delivered'
                    : tracking.status}
                </span>
              </div>

              <div className="mt-6 space-y-0">
                {timeline.map((step, i) => (
                  <div key={step.label} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      {step.done ? (
                        <Fa name="check-circle2" className="h-6 w-6 text-flame-600" />
                      ) : (
                        <Fa name="circle" className="h-6 w-6 text-ink-200" />
                      )}
                      {i < timeline.length - 1 && (
                        <span className={cn('w-px flex-1', step.done ? 'bg-flame-300' : 'bg-ink-100')} />
                      )}
                    </div>
                    <div className={cn('pb-7', !step.done && 'opacity-60')}>
                      <div className="font-semibold text-ink-900">{step.label}</div>
                      <div className="text-sm text-ink-500">{step.place}</div>
                      <div className="text-xs text-ink-400">{step.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="card p-5">
                <h3 className="font-bold text-ink-900">Shipment details</h3>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <Fa name="map-pin" className="h-4 w-4 text-ink-300" />
                    <span className="flex-1 text-ink-400">From</span>
                    <span className="font-semibold text-ink-900">
                      {tracking.journey?.sourceStation?.name || 'Kigali'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Fa name="map-pin" className="h-4 w-4 text-ink-300" />
                    <span className="flex-1 text-ink-400">To</span>
                    <span className="font-semibold text-ink-900">
                      {tracking.journey?.destinationStation?.name || 'Huye'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Fa name="truck" className="h-4 w-4 text-ink-300" />
                    <span className="flex-1 text-ink-400">Receiver</span>
                    <span className="font-semibold text-ink-900">{tracking.receiverName}</span>
                  </div>
                </dl>
              </div>
              <div className="card p-5">
                <h3 className="font-bold text-ink-900">Need help?</h3>
                <p className="mt-1 text-sm text-ink-500">Contact our support team for any delivery questions.</p>
                <a href="tel:+250****0000" className="btn-outline mt-3 w-full">
                  <Fa name="phone" className="h-4 w-4" /> Call Support
                </a>
              </div>
            </aside>
          </div>
        ) : shown && !tracking ? (
          <div className="mx-auto max-w-md text-center text-ink-400">
            <Fa name="package" className="mx-auto h-10 w-10 text-ink-200" />
            <p className="mt-3 text-sm">
              No parcel found with that code.{' '}
              <button
                onClick={() => { setCode('TR-9K2L-88X'); setShown(false); setError(null) }}
                className="font-semibold text-flame-600"
              >
                Try TR-9K2L-88X
              </button>
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-md text-center text-ink-400">
            <Fa name="package" className="mx-auto h-10 w-10 text-ink-200" />
            <p className="mt-3 text-sm">
              Enter a tracking code above to view your parcel status. Try{' '}
              <button
                onClick={() => { setCode('TR-9K2L-88X'); setShown(false); setError(null) }}
                className="font-semibold text-flame-600"
              >
                TR-9K2L-88X
              </button>{' '}
              for a demo.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
