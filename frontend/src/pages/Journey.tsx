import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useRealtimeTrip } from '../lib/useRealtimeTrip'
import Fa from '../components/Fa';

const MOCK_STOPS = [
  { name: 'Kigali (Nyabugogo)', time: '08:00 AM', state: 'done' as const },
  { name: 'Muhanga', time: '08:50 AM', state: 'current' as const },
  { name: 'Nyanza', time: '10:10 AM', state: 'upcoming' as const },
  { name: 'Huye (Main Station)', time: '11:30 AM', state: 'upcoming' as const },
]

export default function Journey() {
  const [arrived, setArrived] = useState(false)

  // In production, tripId comes from route params or booking context.
  // For now we use a placeholder — the hook won't connect without a real tripId.
  const tripId = new URLSearchParams(window.location.search).get('tripId')
  const { position, lastStop, etaUpdates, connected, error } = useRealtimeTrip(tripId)

  // Build dynamic stops list from API data when available
  const stops = MOCK_STOPS.map((s) => {
    // If a stop was reported as reached via socket, mark it done
    if (lastStop && s.name.toLowerCase().includes(lastStop.stopId.toLowerCase())) {
      return { ...s, state: 'done' as const }
    }
    return s
  })

  const nextStopEta = etaUpdates[etaUpdates.length - 1]

  return (
    <div className="bg-mist py-10">
      <div className="container-page">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink-900">
                <Fa name="navigation" className="h-5 w-5 text-flame-600" /> Live Journey
              </h1>
              <p className="text-sm text-ink-500">Real-time tracking & waitlist status</p>
            </div>
            <div className="flex items-center gap-2">
              {connected && (
                <span className="chip bg-emerald-100 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live
                </span>
              )}
              {!connected && tripId && (
                <span className="chip bg-amber-100 text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Connecting...
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
              <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {arrived ? (
            <Arrived onReset={() => setArrived(false)} />
          ) : (
            <LiveTracking
              onArrive={() => setArrived(true)}
              position={position}
              nextStopEta={nextStopEta}
              stops={stops}
              connected={connected}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function LiveTracking({
  onArrive,
  position,
  nextStopEta,
  stops,
  connected,
}: {
  onArrive: () => void
  position: { lat: number; lng: number; speed: number; timestamp: number } | null
  nextStopEta: { stopName: string; etaMinutes: number } | undefined
  stops: typeof MOCK_STOPS
  connected: boolean
}) {
  const currentStop = stops.find((s) => s.state === 'current')
  const currentStopEta = nextStopEta?.stopName
    ? nextStopEta
    : currentStop
      ? { stopName: currentStop.name, etaMinutes: 12 }
      : null

  return (
    <div className="card overflow-hidden">
      {/* Map */}
      <div className="relative h-56 bg-[radial-gradient(circle_at_30%_30%,#E7E5F7,#F5F4FF)]">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <path d="M40 200 C 120 120, 200 160, 320 60" stroke="#10075C" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" fill="none" />
        </svg>
        <span className="absolute left-8 bottom-12 grid h-6 w-6 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full bg-white shadow-card">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="absolute right-10 top-10 grid h-6 w-6 place-items-center rounded-full bg-white shadow-card">
          <Fa name="map-pin" className="h-3.5 w-3.5 text-flame-600" />
        </span>
        {position && (
          <span className="absolute left-1/2 top-1/3 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
            <Fa name="bus" className="h-3.5 w-3.5" />
            {position.speed > 0
              ? `${Math.round(position.speed * 3.6)} km/h`
              : 'Stopped'}
          </span>
        )}
        {!position && connected && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-ink-400 animate-pulse">
            Waiting for GPS data...
          </span>
        )}
      </div>

      <div className="p-5">
        {currentStopEta ? (
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
              <Fa name="map-pin" className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="font-bold text-ink-900">
                {connected ? 'Next Stop:' : 'Next Stop:'} {currentStopEta.stopName}
              </div>
              <div className="text-xs text-ink-400">
                {currentStopEta.etaMinutes >= 0
                  ? `Arriving in ${currentStopEta.etaMinutes} minutes`
                  : 'Calculating ETA...'}
              </div>
            </div>
            <span className="chip bg-white text-ink-500">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-400">
              <Fa name="map-pin" className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="font-bold text-ink-900">En route</div>
              <div className="text-xs text-ink-400">Checking route progress...</div>
            </div>
          </div>
        )}

        {/* Route timeline */}
        <div className="mt-5">
          <div className="label">Route details</div>
          <ol className="relative ml-2 border-l border-dashed border-ink-200">
            {stops.map((s) => (
              <li key={s.name} className="mb-4 ml-5 last:mb-0">
                <span
                  className={cn(
                    'absolute -left-[7px] grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-mist',
                    s.state === 'done' && 'bg-emerald-500',
                    s.state === 'current' && 'bg-flame-600',
                    s.state === 'upcoming' && 'bg-ink-200',
                  )}
                />
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm', s.state === 'upcoming' ? 'text-ink-400' : 'font-semibold text-ink-900')}>
                    {s.name}
                  </span>
                  <span className="text-xs text-ink-400">
                    {s.state === 'done' ? '✓' : s.time}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 flex gap-3">
          <a href="tel:+250788000000" className="btn-outline flex-1">
            <Fa name="phone" className="h-4 w-4" /> Call driver
          </a>
          <button onClick={onArrive} className="btn-primary flex-1">
            Simulate arrival <Fa name="chevronright" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Arrived({ onReset }: { onReset: () => void }) {
  const [rating, setRating] = useState(5)
  return (
    <div className="card p-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <Fa name="navigation" className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-ink-900">You have arrived!</h2>
      <p className="mt-1 text-sm text-ink-500">We hope you had a pleasant journey from Kigali to Huye.</p>

      <div className="mt-5 rounded-2xl bg-ink-50 p-5">
        <div className="text-xs font-bold uppercase tracking-wide text-ink-400">Rate your experience</div>
        <div className="mt-3 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`}>
              <Fa name="star" className={cn('h-8 w-8 transition', n <= rating ? 'fill-flame-500 text-flame-500' : 'text-ink-200')} />
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-ink-400">Driver: Paul B.</div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Link to="/search" className="btn-primary">
          <Fa name="rotateccw" className="h-4 w-4" /> Book Return Trip
        </Link>
        <Link to="/dashboard" className="btn-ghost">
          <Fa name="home" className="h-4 w-4" /> Go to Dashboard
        </Link>
        <button onClick={onReset} className="text-xs font-semibold text-ink-400 hover:text-ink-900">
          <Fa name="clock" className="mr-1 inline h-3 w-3" /> Replay live tracking
        </button>
      </div>
    </div>
  )
}
