import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cn } from '../lib/utils'
import { api, ApiError } from '../lib/api'
import { useRealtimeTrip } from '../lib/useRealtimeTrip'
import Fa from '../components/Fa';

interface JourneyDetails {
  journeyId: string;
  totalCapacity: number;
  bookedSeats: number[];
  availableSeats: number[];
  journey: {
    id: string;
    departureTime: string;
    price: number;
    sourceStation: { id: string; name: string; location: string };
    destinationStation: { id: string; name: string; location: string };
    vehicle: { id: string; plateNumber: string; model: string; capacity: number };
  };
}

interface RouteStop {
  name: string;
  time: string;
  state: 'done' | 'current' | 'upcoming';
}

function deriveStops(details: JourneyDetails | null): RouteStop[] {
  if (!details) return [];
  const dep = new Date(details.journey.departureTime);
  // Build a rough 2-stop timeline: source + destination. The websocket will
  // mark the destination as 'done' if `lastStop` matches.
  // (Intermediate stops aren't returned by /availability — keep the UI simple.)
  return [
    {
      name: details.journey.sourceStation.name,
      time: dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      state: 'done',
    },
    {
      name: details.journey.destinationStation.name,
      time: '—',
      state: 'upcoming',
    },
  ];
}

export default function Journey() {
  const [searchParams] = useSearchParams()
  const tripId = searchParams.get('tripId')

  const [details, setDetails] = useState<JourneyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)

  const { position, lastStop, etaUpdates, connected } = useRealtimeTrip(tripId)

  // Load the real journey details — replaces the previous MOCK_STOPS.
  useEffect(() => {
    if (!tripId) {
      setLoading(false)
      setError('No trip selected. Open this page from an active ticket to track your journey.')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get(`/api/journeys/${tripId}/availability`)
      .then((data) => { if (!cancelled) setDetails(data as JourneyDetails) })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load journey')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tripId])

  // Mark the destination as 'done' when the server reports that stop reached.
  const stops = deriveStops(details).map((s) => {
    if (lastStop && details && s.name === details.journey.destinationStation.name) {
      return { ...s, state: 'done' as const }
    }
    return s
  })

  const nextStopEta = etaUpdates[etaUpdates.length - 1]

  if (loading) {
    return (
      <div className="bg-mist py-20">
        <div className="container-page flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
        </div>
      </div>
    )
  }

  if (!details && error) {
    return (
      <div className="bg-mist py-20">
        <div className="container-page mx-auto max-w-md text-center">
          <Fa name="alert-circle" className="mx-auto h-12 w-12 text-flame-600" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">Couldn't load journey</h1>
          <p className="mt-2 text-sm text-ink-500">{error}</p>
          <Link to="/dashboard/trips" className="btn-primary mt-6 inline-flex">
            Back to my trips
          </Link>
        </div>
      </div>
    )
  }

  if (arrived) {
    return <Arrived onReset={() => setArrived(false)} destination={details?.journey.destinationStation.name} />
  }

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
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Connecting…
                </span>
              )}
            </div>
          </div>

          <LiveTracking
            onArrive={() => setArrived(true)}
            position={position}
            nextStopEta={nextStopEta}
            stops={stops}
            connected={connected}
            vehiclePlate={details?.journey.vehicle.plateNumber}
          />
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
  vehiclePlate,
}: {
  onArrive: () => void
  position: { lat: number; lng: number; speed: number; timestamp: number } | null
  nextStopEta: { stopName: string; etaMinutes: number } | undefined
  stops: RouteStop[]
  connected: boolean
  vehiclePlate?: string
}) {
  const upcoming = stops.find((s) => s.state === 'upcoming')
  const currentStopEta = nextStopEta ?? (upcoming ? { stopName: upcoming.name, etaMinutes: -1 } : null)

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
            Waiting for GPS data…
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
                Next stop: {currentStopEta.stopName}
              </div>
              <div className="text-xs text-ink-400">
                {currentStopEta.etaMinutes >= 0
                  ? `Arriving in ${currentStopEta.etaMinutes} minutes`
                  : 'Calculating ETA…'}
              </div>
            </div>
            {connected && <span className="chip bg-white text-ink-500">Live</span>}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-400">
              <Fa name="map-pin" className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="font-bold text-ink-900">En route</div>
              <div className="text-xs text-ink-400">
                {vehiclePlate ? `Vehicle ${vehiclePlate}` : 'Checking route progress…'}
              </div>
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
          <a href="tel:+250****0000" className="btn-outline flex-1">
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

function Arrived({ onReset, destination }: { onReset: () => void; destination?: string }) {
  const [rating, setRating] = useState(5)
  return (
    <div className="card p-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <Fa name="navigation" className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-ink-900">You have arrived!</h2>
      <p className="mt-1 text-sm text-ink-500">
        We hope you had a pleasant journey{destination ? ` to ${destination}` : ''}.
      </p>

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
