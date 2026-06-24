import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn, rwf } from '../../lib/utils';
import { api, ApiError } from '../../lib/api';
import Fa from '../../components/Fa';
import { Skeleton, SkeletonListItem, SkeletonHeader } from '../../components/Skeleton';

interface TripTicket {
  id: string
  seatNumber: number
  status: string
  createdAt: string
  journey: {
    id: string
    departureTime: string
    price: number
    sourceStation: { name: string }
    destinationStation: { name: string }
    vehicle: { plateNumber: string; agency?: { name: string; amenities?: string[] } }
  }
}

const tabs = ['All', 'Upcoming', 'Completed', 'Cancelled'] as const
const statusStyles: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-ink-100 text-ink-700',
  CANCELLED: 'bg-flame-100 text-flame-700',
}

export default function MyTrips() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('All')
  const [tickets, setTickets] = useState<TripTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/tickets/my')
      const list = data.items || data.tickets || data
      setTickets(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load trips')
    } finally {
      setLoading(false)
    }
  }

  const filtered = tab === 'All'
    ? tickets
    : tickets.filter((t) => {
        if (tab === 'Upcoming') return t.status === 'PAID'
        if (tab === 'Completed') return t.status === 'COMPLETED'
        if (tab === 'Cancelled') return t.status === 'CANCELLED'
        return true
      })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">My Trips</h1>
        <p className="text-ink-500">View and manage all your bus bookings.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              tab === t ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonHeader />
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-white">
                    <Fa name="bus" className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-bold text-ink-900">
                      {t.journey?.sourceStation?.name || 'N/A'} → {t.journey?.destinationStation?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-ink-400">
                      {t.journey?.vehicle?.agency?.name || ''} · Ticket #{t.id.slice(0, 8)}
                    </div>
                  </div>
                </div>
                <span className={cn('chip', statusStyles[t.status] || 'bg-ink-100 text-ink-700')}>
                  {t.status === 'PAID' ? 'Upcoming' : t.status === 'COMPLETED' ? 'Completed' : t.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <Fa name="calendar" className="h-4 w-4 text-ink-300" />
                    {new Date(t.journey?.departureTime || t.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <Fa name="ticket" className="h-4 w-4 text-ink-300" /> Seat {t.seatNumber}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <Fa name="map-pin" className="h-4 w-4 text-ink-300" /> {rwf(t.journey?.price || 0)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {t.status === 'PAID' && (
                    <>
                      <Link
                        to={`/journey?tripId=${t.journey?.id || ''}`}
                        className="btn-flame px-4 py-2 text-xs"
                      >
                        <Fa name="navigation" className="h-3.5 w-3.5" /> Track Live
                      </Link>
                      <button className="btn-primary px-4 py-2 text-xs">
                        <Fa name="download" className="h-3.5 w-3.5" /> Ticket
                      </button>
                    </>
                  )}
                  <Link to="/search" className="btn-outline px-4 py-2 text-xs">
                    {t.status === 'COMPLETED' ? 'Rebook' : 'Details'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-ink-400">
          No {tab.toLowerCase()} trips yet.
          <br />
          <Link to="/search" className="mt-2 inline-block font-semibold text-flame-600">
            Book a trip
          </Link>
        </div>
      )}
    </div>
  )
}
