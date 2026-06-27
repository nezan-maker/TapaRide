import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { cn, rwf } from '../lib/utils';
import { api, ApiError } from '../lib/api';
import Fa from '../components/Fa';
import { Skeleton } from '../components/Skeleton';

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
  { key: 'morning', label: 'Morning', sub: '6am–12pm', icon: 'sun' },
  { key: 'afternoon', label: 'Afternoon', sub: '12pm–6pm', icon: 'sunset' },
  { key: 'evening', label: 'Evening', sub: '6pm–10pm', icon: 'moon' },
]

const ITEMS_PER_PAGE = 5

export default function SearchResults() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [trips, setTrips] = useState<BusTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [timeFilter, setTimeFilter] = useState<string | null>(null)
  const [stationsList, setStationsList] = useState<string[]>([])
  const [modifyFrom, setModifyFrom] = useState(from)
  const [modifyTo, setModifyTo] = useState(to)
  const [modifyDate, setModifyDate] = useState(date)

  // Sync modify fields when URL params change
  useEffect(() => {
    setModifyFrom(from)
    setModifyTo(to)
    setModifyDate(date)
  }, [from, to, date])

  // Fetch stations for the modify-search dropdown
  useEffect(() => {
    fetchStations()
  }, [])

  const fetchStations = async () => {
    try {
      const data = await api.get('/api/stations')
      const list = data.stations || data.items || data
      const names = Array.isArray(list) ? list.map((s: any) => s.name || s).filter(Boolean) : []
      setStationsList(names.length > 0 ? names : ['Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)', 'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi'])
    } catch {
      setStationsList(['Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)', 'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi'])
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [from, to, date])

  const fetchTrips = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/api/journeys`)
      const allTrips: BusTrip[] = Array.isArray(data.items) ? data.items : Array.isArray(data.journeys) ? data.journeys : Array.isArray(data) ? data : []

      // Apply filters client-side if from/to provided
      let filtered = allTrips
      if (from) {
        filtered = filtered.filter((t) =>
          t.sourceStation?.name?.toLowerCase().includes(from.toLowerCase())
        )
      }
      if (to) {
        filtered = filtered.filter((t) =>
          t.destinationStation?.name?.includes(to)
        )
      }

      setTrips(filtered)
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
    <div className="bg-mist min-h-screen">
      {/* Persistent modify-search bar */}
      <div className="border-b border-ink-50 bg-white py-4">
        <div className="container-page">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/search?from=${encodeURIComponent(modifyFrom)}&to=${encodeURIComponent(modifyTo)}&date=${modifyDate}`)
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[160px]">
              <label className="label">From</label>
              <input
                className="input"
                list="stations-list"
                placeholder="Departure city"
                value={modifyFrom}
                onChange={(e) => setModifyFrom(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink-100 text-ink-400 hover:bg-ink-50 transition-colors"
              onClick={() => { setModifyFrom(modifyTo); setModifyTo(modifyFrom) }}
              aria-label="Swap cities"
            >
              <Fa name="arrowleftright" className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-[160px]">
              <label className="label">To</label>
              <input
                className="input"
                list="stations-list-to"
                placeholder="Destination city"
                value={modifyTo}
                onChange={(e) => setModifyTo(e.target.value)}
              />
            </div>
            <div className="w-[180px]">
              <label className="label">Travel date</label>
              <div className="relative">
                <Fa name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="date"
                  className="input pl-9 pr-9"
                  value={modifyDate}
                  onChange={(e) => setModifyDate(e.target.value)}
                />
                <Fa name="calendar" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-200" />
              </div>
            </div>
            <button
              type="submit"
              disabled={!modifyFrom || !modifyTo}
              className="btn-primary px-6 py-2.5 h-10 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Fa name="search" className="h-3.5 w-3.5" />
              {modifyFrom && modifyTo ? 'Search' : 'Select cities'}
            </button>
          </form>
          <datalist id="stations-list">
            {stationsList.map((c) => <option key={c} value={c} />)}
          </datalist>
          <datalist id="stations-list-to">
            {stationsList.filter((s) => s !== modifyFrom).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      <div className="container-page py-8">
        <div className="mb-6">
          {from && to ? (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                {from.split('(')[0].trim()} <span className="text-ink-300 mx-1">—</span> {to.split('(')[0].trim()}
              </h1>
              <p className="mt-1.5 text-sm text-ink-400">
                <Fa name="calendar" className="mr-1 inline h-3.5 w-3.5" />
                {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {loading ? ' · Searching...' : ` · ${filtered.length} ${filtered.length === 1 ? 'trip' : 'trips'} available`}
              </p>
            </>
          ) : (
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">Available Trips</h1>
              <p className="mt-4 text-sm text-ink-500 max-w-md">
                All available bus routes across Rwanda. Use the filters above to narrow your search.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="card p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <Skeleton variant="title" width="1/4" height="1rem" />
                    <Skeleton variant="text" width="1/3" />
                  </div>
                  <Skeleton variant="btn" width="md" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {departureWindows.map((w) => (
                <button
                  key={w.key}
                  onClick={() => { setTimeFilter(timeFilter === w.key ? null : w.key); setPage(0) }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition',
                    timeFilter === w.key
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-ink-500 hover:bg-ink-50 border border-ink-100',
                  )}
                >
                  <Fa name={w.icon} className="h-3 w-3" />
                  {w.label}
                  <span className="opacity-60">{w.sub}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {visible.map((trip) => {
                const bookedCount = trip._count?.tickets || 0
                const capacity = trip.vehicle?.capacity || 30
                const available = capacity - bookedCount
                const fill = Math.round((bookedCount / capacity) * 100)
                const depTime = new Date(trip.departureTime)
                const arrTime = new Date(depTime.getTime() + 4 * 60 * 60 * 1000)

                return (
                  <button
                    key={trip.id}
                    onClick={() => navigate(`/trip/${trip.id}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`)}
                    className="card w-full overflow-hidden text-left hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex min-w-0 flex-1 items-center gap-5">
                        <div className="text-center w-14">
                          <div className="text-lg font-bold text-ink-900 leading-none">
                            {depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-300">
                            {trip.sourceStation.name.split('(')[0].trim()}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
                          <div className="text-[10px] text-ink-300 font-medium">
                            {Math.round((arrTime.getTime() - depTime.getTime()) / 3600000)}h
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="h-px w-2 bg-ink-200" />
                            <span className="h-1.5 w-1.5 rounded-full border-2 border-ink-200" />
                            <span className="h-px w-2 bg-ink-200" />
                          </div>
                          <div className="text-[10px] font-medium text-ink-300">{trip.destinationStation.name.split('(')[0].trim()}</div>
                        </div>
                        <div className="text-center w-14">
                          <div className="text-xl font-bold text-ink-900 leading-none">
                            {arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-300">
                            {trip.destinationStation.name.split('(')[0].trim()}
                          </div>
                        </div>
                        <div className="hidden sm:block min-w-0">
                          <div className="text-sm font-semibold text-ink-900">{trip.vehicle?.agency?.name || 'Transport Co.'}</div>
                          <div className="mt-0.5 text-xs text-ink-400">
                            {trip.vehicle?.plateNumber} · {capacity} seats
                            {fill > 70 && <span className="ml-1.5 text-flame-500 font-medium">{available} left</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="text-xl font-bold text-ink-900">{rwf(trip.price)}</div>
                          <div className="text-[10px] text-ink-300 font-medium">per seat</div>
                        </div>
                        <div className="btn-flame px-4 py-2.5 text-sm">
                          View Details <Fa name="arrowright" className="ml-1 inline h-3 w-3" />
                        </div>
                      </div>
                    </div>
                    {fill > 0 && (
                      <div className="h-1 bg-ink-50">
                        <div
                          className={cn('h-full transition-all duration-500', fill > 80 ? 'bg-flame-500' : fill > 50 ? 'bg-amber-500' : 'bg-emerald-500')}
                          style={{ width: `${Math.min(fill, 100)}%` }}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {pageCount > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="btn-outline py-2 px-4 text-sm disabled:opacity-30"
                >
                  <Fa name="chevronleft" className="h-4 w-4" /> Previous
                </button>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold transition',
                      i === page ? 'bg-ink-900 text-white' : 'text-ink-400 hover:bg-ink-50',
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
                  Next <Fa name="chevronright" className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : from && to && filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Fa name="bus" className="mx-auto h-12 w-12 text-ink-100" />
            <h2 className="mt-4 text-xl font-bold text-ink-900">No trips available</h2>
            <p className="mt-2 text-sm text-ink-500">
              No journeys from {from} to {to} on {new Date(date).toLocaleDateString()}.<br />
              Try a different date or route.
            </p>
            <Link to="/" className="btn-primary mt-6 inline-flex">
              Try a different search
            </Link>
          </div>
        ) : trips.length === 0 ? (
          <div className="card p-12 text-center">
            <Fa name="bus" className="mx-auto h-12 w-12 text-ink-100" />
            <h2 className="mt-4 text-xl font-bold text-ink-900">No trips available</h2>
            <p className="mt-2 text-sm text-ink-500">
              There are currently no journeys scheduled. Check back later.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
