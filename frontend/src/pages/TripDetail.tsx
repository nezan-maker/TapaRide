import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { cn, rwf } from '../lib/utils'
import { api, ApiError } from '../lib/api'
import Fa from '../components/Fa'
import { Skeleton } from '../components/Skeleton'

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
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [journey, setJourney] = useState<JourneyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJourney()
  }, [tripId]) // eslint-disable-line

  const fetchJourney = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/api/journeys/${tripId}`)
      setJourney(data.journey || data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load trip details')
    } finally {
      setLoading(false)
    }
  }

  const handleBook = () => {
    navigate(`/booking?journeyId=${tripId}`)
  }

  if (loading) {
    return (
      <div className="bg-mist min-h-screen">
        <div className="container-page py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Skeleton variant="title" width="1/3" height="1.5rem" />
              <Skeleton variant="text" width="1/2" />
              <div className="card p-6 space-y-4">
                <Skeleton variant="text" width="1/4" />
                <Skeleton variant="text" width="1/3" />
                <Skeleton variant="text" width="1/2" />
              </div>
            </div>
            <div className="card p-6 h-fit space-y-4">
              <Skeleton variant="title" width="1/2" height="1.5rem" />
              <Skeleton variant="btn" className="w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !journey) {
    return (
      <div className="bg-mist min-h-screen">
        <div className="container-page py-12">
          <div className="card p-12 text-center max-w-md mx-auto">
            <Fa name="alert-circle" className="mx-auto h-12 w-12 text-flame-300" />
            <h2 className="mt-4 text-xl font-bold text-ink-900">Unable to load trip</h2>
            <p className="mt-2 text-sm text-ink-500">{error || 'Trip not found'}</p>
            <Link to="/search" className="btn-primary mt-6 inline-flex">Back to Search</Link>
          </div>
        </div>
      </div>
    )
  }

  const bookedCount = journey._count?.tickets || 0
  const capacity = journey.vehicle?.capacity || 30
  const available = capacity - bookedCount
  const fill = Math.round((bookedCount / capacity) * 100)
  const depTime = new Date(journey.departureTime)
  const arrTime = journey.estimatedArrival ? new Date(journey.estimatedArrival) : depTime
  const durationMin = Math.round((arrTime.getTime() - depTime.getTime()) / 60000)

  return (
    <div className="bg-mist min-h-screen">
      {/* Nav bar */}
      <div className="bg-white border-b border-ink-50">
        <div className="container-page flex items-center justify-between py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
          >
            <Fa name="chevronleft" className="h-3.5 w-3.5" />
            Back to results
          </button>
          <span className="text-xs font-medium text-ink-300">
            {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Route header */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-ink-900">
                {journey.sourceStation.name.split('(')[0].trim()}
                <span className="text-ink-300 mx-2 font-light">\u2014</span>
                {journey.destinationStation.name.split('(')[0].trim()}
              </h1>
              <p className="mt-1 text-sm text-ink-400">
                {depTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Journey card */}
            <div className="card overflow-hidden">
              <div className="p-6">
                {/* Time row */}
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink-900 leading-none">
                      {depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[10px] text-ink-400 mt-1 uppercase tracking-wide font-medium">{journey.sourceStation.name.split('(')[0].trim()}</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-[10px] text-ink-300 font-medium uppercase tracking-wide mb-1">
                      {durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`}
                    </div>
                    <div className="w-full flex items-center">
                      <span className="h-px flex-1 bg-ink-200" />
                      <Fa name="bus" className="h-3 w-3 mx-2 text-ink-300" />
                      <span className="h-px flex-1 bg-ink-200" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ink-900 leading-none">
                      {arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[10px] text-ink-400 mt-1 uppercase tracking-wide font-medium">{journey.destinationStation.name.split('(')[0].trim()}</div>
                  </div>

                <hr className="my-5 border-ink-50" />

                {/* Vehicle info */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <Fa name="bus" className="h-4 w-4" />
                    {journey.vehicle?.agency?.name || 'Transport Co.'}
                  </span>
                  <span className="text-ink-100">|</span>
                  <span>Plate {journey.vehicle?.plateNumber}</span>
                  <span className="text-ink-100">|</span>
                  <span>{capacity} seats</span>
                </div>

                {/* Availability bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-ink-500">Seat availability</span>
                    <span className={cn(
                      'font-semibold',
                      fill > 80 ? 'text-flame-600' : fill > 50 ? 'text-amber-500' : 'text-emerald-500',
                    )}>
                      {available} of {capacity} spots left
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-50">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        fill > 80 ? 'bg-flame-500' : fill > 50 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(fill, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Amenities */}
                {journey.vehicle?.amenities && journey.vehicle.amenities.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {journey.vehicle.amenities.map((a: string) => (
                      <span key={a} className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stops info */}
            <div className="card p-6">
              <h2 className="font-bold text-ink-900 mb-4">Route</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                    <span className="h-6 w-px bg-ink-100 mt-1" />
                  </div>
                  <div>
                    <div className="font-semibold text-ink-900">{journey.sourceStation.name}</div>
                    <div className="text-xs text-ink-400">{journey.sourceStation.location}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-flame-500 ring-4 ring-flame-100" />
                  </div>
                  <div>
                    <div className="font-semibold text-ink-900">{journey.destinationStation.name}</div>
                    <div className="text-xs text-ink-400">{journey.destinationStation.location}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky booking sidebar */}
          <div>
            <div className="card p-6 sticky top-24">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-ink-900">{rwf(journey.price)}</div>
                  <div className="text-xs text-ink-400 mt-0.5">per seat</div>
                </div>
                {available > 0 && available <= 5 && (
                  <span className="text-xs font-semibold text-flame-500 bg-flame-50 px-2 py-1 rounded-full">
                    Only {available} left
                  </span>
                )}
              </div>

              <button
                onClick={handleBook}
                disabled={available === 0}
                className="btn-primary w-full py-4 mt-5 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {available === 0 ? 'Fully Booked' : (
                  <>Book This Trip <Fa name="arrowright" className="ml-1.5 inline h-4 w-4" /></>
                )}
              </button>

              <p className="mt-3 text-center text-xs text-ink-400">
                Pay with Tapa Wallet or Card
              </p>

              <hr className="my-5 border-ink-50" />

              <div className="space-y-3 text-xs text-ink-500">
                <div className="flex items-center gap-2">
                  <Fa name="shieldcheck" className="h-3.5 w-3.5 text-emerald-500" />
                  Secure payment
                </div>
                <div className="flex items-center gap-2">
                  <Fa name="checkmarkcircle" className="h-3.5 w-3.5 text-emerald-500" />
                  Instant e-ticket
                </div>
                <div className="flex items-center gap-2">
                  <Fa name="refresh" className="h-3.5 w-3.5 text-ink-400" />
                  Free cancellation up to 1h before
                </div>
                <div className="flex items-center gap-2">
                  <Fa name="location" className="h-3.5 w-3.5 text-ink-400" />
                  Live GPS tracking on trip day
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
