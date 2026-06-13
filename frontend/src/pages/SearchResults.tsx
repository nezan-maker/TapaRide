import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, ArrowRight, Sun, Sunset, Moon, Bus, ChevronLeft, ChevronRight, Calendar, Pencil, AlertCircle } from 'lucide-react'
import { cn, rwf } from '../lib/utils'
import { api, ApiError } from '../lib/api'

interface BusTrip {
  id: string
  sourceStation: { name: string; location: string }
  destinationStation: { name: string; location: string }
  departureTime: string
  price: number
  vehicle: { plateNumber: string; capacity: number; amenities?: string[]; seatLayout?: any; agency?: { name: string } }
  _count: { tickets: number }
}

const departureWindows = [
  { key: 'morning', label: 'Morning', sub: '6am–12pm', icon: Sun },
  { key: 'afternoon', label: 'Afternoon', sub: '12pm–6pm', icon: Sunset },
  { key: 'evening', label: 'Evening', sub: '6pm–10pm', icon: Moon },
]

const ITEMS_PER_PAGE = 5

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') || 'Kigali (Nyabugogo)'
  const to = searchParams.get('to') || 'Huye'
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [trips, setTrips] = useState<BusTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [timeFilter, setTimeFilter] = useState<string | null>(null)

  useEffect(() => {
    fetchTrips()
  }, [from, to, date])

  const fetchTrips = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/api/journeys?sourceId=&destId=`)
      const list = data.items || data.journeys || data
      setTrips(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load journeys')
      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!timeFilter) return trips
    return trips.filter((t) => {
      const hour = new Date(t.departureTime).getHours()
      if (timeFilter === 'morning') return hour >= 6 && hour < 12
      if (timeFilter === 'afternoon') return hour >= 12 && hour < 18
      if (timeFilter === 'evening') return hour >= 18 || hour < 6
      return true
    })
  }, [trips, timeFilter])

  const pageCount = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const visible = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

  return (
    <div className="bg-mist py-8 sm:py-12">
      <div className="container-page">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-400">
          <Link to="/" className="hover:text-flame-600">Home</Link>
          <span>/</span>
          <span className="text-ink-600">{from} → {to}</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">
            {from} → {to}
          </h1>
          <p className="mt-1 text-ink-500">
            <Calendar className="mr-1 inline h-4 w-4" />
            {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {loading ? ' · Loading...' : ` · ${filtered.length} trip${filtered.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
          </div>
        ) : visible.length > 0 ? (
          <>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-500">
                <SlidersHorizontal className="h-4 w-4" /> Filter by
              </span>
              {departureWindows.map((w) => (
                <button
                  key={w.key}
                  onClick={() => {
                    setTimeFilter(timeFilter === w.key ? null : w.key)
                    setPage(0)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
                    timeFilter === w.key
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-ink-500 hover:bg-ink-50',
                  )}
                >
                  <w.icon className={cn('h-4 w-4', timeFilter === w.key ? '' : 'text-ink-300')} />
                  {w.label}
                  <span className="text-xs opacity-60">{w.sub}</span>
                </button>
              ))}
            </div>

            {/* Trip Cards */}
            <div className="space-y-4">
              {visible.map((trip) => {
                const bookedCount = trip._count?.tickets || 0
                const capacity = trip.vehicle?.capacity || 30
                const fill = Math.round((bookedCount / capacity) * 100)
                const depTime = new Date(trip.departureTime)
                const arrTime = new Date(depTime.getTime() + 4 * 60 * 60 * 1000) // Approx 4h

                return (
                  <div key={trip.id} className="card overflow-hidden transition hover:shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
                          <Bus className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink-900">
                              {depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <ArrowRight className="h-3 w-3 text-ink-300" />
                            <span className="font-bold text-ink-900">
                              {arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="font-bold text-ink-900 text-sm mt-1">
                            {trip.sourceStation.name} → {trip.destinationStation.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-ink-400 mt-0.5">
                            <span>{trip.vehicle?.agency?.name || 'Transport Co.'}</span>
                            <span>·</span>
                            <span>Plate: {trip.vehicle?.plateNumber}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <div className="text-lg font-extrabold text-ink-900">{rwf(trip.price)}</div>
                          <div className="text-xs text-ink-400">
                            <span className={cn(fill > 80 ? 'text-flame-600 font-semibold' : 'text-ink-400')}>
                              {capacity - bookedCount} left
                            </span>
                          </div>
                        </div>
                        <Link
                          to={`/booking?journeyId=${trip.id}`}
                          className="btn-flame shrink-0 px-5 py-2.5 text-sm"
                        >
                          Book
                        </Link>
                      </div>
                    </div>
                    <div className="border-t border-ink-50 px-5 py-2">
                      <div className="flex items-center gap-3 text-xs text-ink-400">
                        <span className="font-medium text-ink-600">{trip.vehicle?.agency?.name || 'Transport Co.'}</span>
                        <span className="h-3 w-px bg-ink-100" />
                        <span>{trip.vehicle?.plateNumber}</span>
                        <span className="h-3 w-px bg-ink-100" />
                        <span>{capacity} seats</span>
                        <span className="h-3 w-px bg-ink-100" />
                        <span className="flex items-center gap-1">
                          Fill:
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                            <div
                              className={cn('h-full rounded-full', fill > 80 ? 'bg-flame-500' : 'bg-emerald-500')}
                              style={{ width: `${Math.min(fill, 100)}%` }}
                            />
                          </div>
                          {fill}%
                        </span>
                      </div>
                      {trip.vehicle?.amenities && trip.vehicle.amenities.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-400">
                          {trip.vehicle.amenities.map((a: string) => {
                            const icon = a.toLowerCase() === 'wifi' ? '📶' : a.toLowerCase() === 'ac' ? '❄️' : a.toLowerCase() === 'charging' ? '🔌' : a.toLowerCase() === 'restroom' ? '🚻' : '✓'
                            return <span key={a}>{icon} {a}</span>
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="btn-outline py-2 px-4 text-sm disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold transition',
                      i === page ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-50',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
                  disabled={page === pageCount - 1}
                  className="btn-outline py-2 px-4 text-sm disabled:opacity-30"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card p-10 text-center">
            <Bus className="mx-auto h-12 w-12 text-ink-200" />
            <h2 className="mt-4 text-xl font-bold text-ink-900">No trips found</h2>
            <p className="mt-2 text-ink-500">
              No available journeys from {from} to {to} on {new Date(date).toLocaleDateString()}.
            </p>
            <Link to="/" className="btn-primary mt-6 inline-flex">
              <Pencil className="h-4 w-4" /> Modify Search
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
