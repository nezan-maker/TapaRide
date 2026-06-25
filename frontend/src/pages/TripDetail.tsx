import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { cn, rwf } from '../lib/utils'
import { api, ApiError } from '../lib/api'
import Fa from '../components/Fa'
import { Skeleton, SkeletonCard } from '../components/Skeleton'

interface JourneyDetail {
  id: string
  departureTime: string
  estimatedArrival: string
  price: number
  status: string
  sourceStation: { id: string; name: string; location: string }
  destinationStation: { id: string; name: string; location: string }
  vehicle: {
    id: string
    plateNumber: string
    model: string
    capacity: number
    amenities: string[]
    seatLayout: any
    agency?: { id: string; name: string; verified: boolean }
  }
  _count: { tickets: number }
}

export default function TripDetail() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [journey, setJourney] = useState<JourneyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJourney()
  }, [tripId])

  async function fetchJourney() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/api/journeys/${tripId}`)
      setJourney((data.journey || data) as JourneyDetail)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load trip details')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (!journey) return null
    const booked = journey._count?.tickets || 0
    const capacity = journey.vehicle?.capacity || 30
    const available = Math.max(0, capacity - booked)
    const fill = capacity > 0 ? Math.round((booked / capacity) * 100) : 0
    const dep = new Date(journey.departureTime)
    const arr = journey.estimatedArrival ? new Date(journey.estimatedArrival) : dep
    const durationMin = Math.round((arr.getTime() - dep.getTime()) / 60000)
    return { booked, capacity, available, fill, dep, arr, durationMin }
  }, [journey])

  if (loading) {
    return (
      <div className="bg-mist min-h-screen">
        <div className="container-page py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Skeleton variant="text" width="1/3" height="2rem" />
              <Skeleton variant="text" width="1/2" />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="space-y-4">
              <SkeletonCard />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !journey || !stats) {
    return (
      <div className="bg-mist min-h-screen">
        <div className="container-page py-12">
          <div className="card p-12 text-center max-w-md mx-auto">
            <Fa name="alert-circle" className="mx-auto h-12 w-12 text-flame-400" />
            <h2 className="mt-4 text-xl font-bold text-ink-900">Unable to load trip</h2>
            <p className="mt-2 text-sm text-ink-500">{error || 'Trip not found'}</p>
            <Link to="/search" className="btn-primary mt-6 inline-flex">
              Back to Search
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { available, fill, dep, arr, durationMin } = stats
  const depCity = journey.sourceStation.name.split('(')[0].trim()
  const arrCity = journey.destinationStation.name.split('(')[0].trim()
  const agencyName = journey.vehicle?.agency?.name || 'Transport Co.'
  const agencyVerified = journey.vehicle?.agency?.verified ?? false
  const amenities = journey.vehicle?.amenities ?? []

  const durationText =
    durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
      : `${durationMin}m`

  const fillColor =
    fill > 80 ? 'bg-flame-500' : fill > 50 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="bg-mist min-h-screen">
      <div className="border-b border-ink-50 bg-white">
        <div className="container-page flex items-center justify-between py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <Fa name="chevronleft" className="h-3.5 w-3.5" />
            Back to results
          </button>
          <span className="text-xs font-medium text-ink-300">
            {new Date(dateParam).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* LEFT — Route header + Journey card + Route stops + Vehicle */}
          <div className="space-y-6">
            {/* Route header */}
            <div>
              <span className="eyebrow">Trip details</span>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900">
                {depCity}
                <span className="mx-3 text-ink-200">→</span>
                {arrCity}
              </h1>
              <p className="mt-1 text-sm text-ink-400">
                {dep.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            {/* Journey card — time rail + vehicle */}
            <div className="card overflow-hidden">
              <div className="p-7">
                {/* Time rail */}
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink-900 leading-none">
                      {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="mt-1.5 text-xs uppercase tracking-wide font-medium text-ink-400">
                      {depCity}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xs uppercase tracking-wide font-medium text-ink-300 mb-2">
                      {durationText}
                    </span>
                    <div className="w-full flex items-center gap-1">
                      <span className="h-px flex-1 bg-ink-200" />
                      <span className="h-2 w-2 rounded-full bg-ink-900" />
                      <Fa name="bus" className="h-3 w-3 text-ink-300 mx-0.5" />
                      <span className="h-2 w-2 rounded-full bg-flame-500" />
                      <span className="h-px flex-1 bg-ink-200" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink-900 leading-none">
                      {arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="mt-1.5 text-xs uppercase tracking-wide font-medium text-ink-400">
                      {arrCity}
                    </div>
                  </div>
                </div>

                <hr className="my-6 border-ink-50" />

                {/* Vehicle summary */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-700">
                    <Fa name="bus" className="h-4 w-4" />
                    {agencyName}
                    {agencyVerified && (
                      <Fa name="checkcircle" className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </span>
                  <span className="text-ink-200">|</span>
                  <span>Plate {journey.vehicle?.plateNumber}</span>
                  {journey.vehicle?.model && (
                    <>
                      <span className="text-ink-200">|</span>
                      <span>{journey.vehicle.model}</span>
                    </>
                  )}
                  <span className="text-ink-200">|</span>
                  <span>{stats.capacity} seats</span>
                </div>

                {/* Capacity bar */}
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-ink-500">Seat availability</span>
                    <span
                      className={cn(
                        'font-semibold',
                        fill > 80 ? 'text-flame-600' : fill > 50 ? 'text-amber-500' : 'text-emerald-500',
                      )}
                    >
                      {available} of {stats.capacity} spots left
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-50">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', fillColor)}
                      style={{ width: `${Math.min(fill, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Amenities */}
                {amenities.length > 0 && (
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-300 mr-1">
                      Onboard
                    </span>
                    {amenities.map((a) => (
                      <span
                        key={a}
                        className="chip bg-ink-50 text-ink-700"
                      >
                        <Fa name="check-circle2" className="h-3 w-3 text-emerald-500" />
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Route stops — from → to */}
            <div className="card overflow-hidden">
              <div className="border-b border-ink-50 px-7 py-4">
                <h2 className="font-bold text-ink-900">Route</h2>
              </div>
              <div className="divide-y divide-ink-50">
                <div className="flex items-start gap-4 px-7 py-5">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="grid h-3 w-3 place-items-center rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Pickup
                    </div>
                    <div className="mt-1 font-bold text-ink-900">
                      {journey.sourceStation.name}
                    </div>
                    <div className="text-sm text-ink-500">{journey.sourceStation.location}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-lg font-bold text-ink-900">
                      {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-ink-400">
                      Same day
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 px-7 py-5">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="grid h-3 w-3 place-items-center rounded-full bg-flame-500 ring-4 ring-flame-100" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-flame-600">
                      Dropoff
                    </div>
                    <div className="mt-1 font-bold text-ink-900">
                      {journey.destinationStation.name}
                    </div>
                    <div className="text-sm text-ink-500">{journey.destinationStation.location}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-lg font-bold text-ink-900">
                      {arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-ink-400">
                      {durationText} later
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Policies */}
            <div className="card p-7">
              <h2 className="font-bold text-ink-900">What's included</h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-600">
                <li className="flex items-start gap-3">
                  <Fa name="shieldcheck" className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>Secure payment protected end-to-end</span>
                </li>
                <li className="flex items-start gap-3">
                  <Fa name="check-circle2" className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>Instant e-ticket delivered to your phone after booking</span>
                </li>
                <li className="flex items-start gap-3">
                  <Fa name="rotateccw" className="mt-0.5 h-4 w-4 text-ink-400" />
                  <span>Free cancellation up to 1 hour before departure</span>
                </li>
                <li className="flex items-start gap-3">
                  <Fa name="navigation" className="mt-0.5 h-4 w-4 text-ink-400" />
                  <span>Live GPS tracking on the day of your trip</span>
                </li>
              </ul>
            </div>
          </div>

          {/* RIGHT — Sticky booking summary */}
          <div>
            <div className="card sticky top-24 overflow-hidden">
              <div className="p-7">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-4xl font-extrabold text-ink-900 tracking-tight">
                      {rwf(journey.price)}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">per seat, taxes included</div>
                  </div>
                  {available > 0 && available <= 5 && (
                    <span className="chip bg-flame-50 text-flame-700">
                      Only {available} left
                    </span>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/booking?journeyId=${tripId}`)}
                  disabled={available === 0}
                  className="btn-primary mt-5 w-full py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {available === 0 ? (
                    'Fully Booked'
                  ) : (
                    <>
                      Book this trip
                      <Fa name="arrowright" className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-xs text-ink-400">
                  Pay with Tapa Wallet or Card
                </p>

                <hr className="my-6 border-ink-50" />

                <div className="space-y-3 text-xs text-ink-500">
                  <div className="flex items-center gap-2.5">
                    <Fa name="shieldcheck" className="h-3.5 w-3.5 text-emerald-500" />
                    Secure payment
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Fa name="check-circle2" className="h-3.5 w-3.5 text-emerald-500" />
                    Instant e-ticket
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Fa name="rotateccw" className="h-3.5 w-3.5 text-ink-400" />
                    Free cancellation 1h prior
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Fa name="navigation" className="h-3.5 w-3.5 text-ink-400" />
                    Live GPS tracking
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
