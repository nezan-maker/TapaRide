import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, Package, Wallet, ArrowRight, MapPin, Calendar, Plus, AlertCircle } from 'lucide-react'
import { cn, rwf } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { api, ApiError } from '../../lib/api'
import DriverDashboard from './DriverDashboard'
import ManagerDashboard from './ManagerDashboard'
import OwnerDashboard from './OwnerDashboard'
import OrganizationDashboard from './OrganizationDashboard'

const statusStyles: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-ink-100 text-ink-700',
  CANCELLED: 'bg-flame-100 text-flame-700',
  IN_TRANSIT: 'bg-flame-100 text-flame-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
}

interface RecentTicket {
  id: string
  seatNumber: number
  status: string
  createdAt: string
  journey: {
    sourceStation: { name: string }
    destinationStation: { name: string }
    departureTime: string
    price: number
  }
}

interface RecentParcel {
  id: string
  trackingCode: string
  status: string
  createdAt: string
  journey?: {
    sourceStation?: { name: string }
    destinationStation?: { name: string }
  }
}

export default function Dashboard() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
      </div>
    )
  }

  switch (user.role) {
    case 'DRIVER':
      return <DriverDashboard />
    case 'MANAGER':
      return <ManagerDashboard />
    case 'OWNER':
      return <OwnerDashboard />
    case 'ORGANIZATION':
      return <OrganizationDashboard />
    case 'CLIENT':
    default:
      return <ClientDashboard />
  }
}

function ClientDashboard() {
  const { user } = useAuth()
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])
  const [recentParcels, setRecentParcels] = useState<RecentParcel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentData()
  }, [])

  const fetchRecentData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ticketData, parcelData] = await Promise.all([
        api.get('/api/tickets/my'),
        api.get('/api/parcels/my'),
      ])
      const tickets = ticketData.items || ticketData.tickets || ticketData
      const parcels = parcelData.items || parcelData.parcels || parcelData
      setRecentTickets(Array.isArray(tickets) ? tickets.slice(0, 3) : [])
      setRecentParcels(Array.isArray(parcels) ? parcels.slice(0, 2) : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const upcomingCount = recentTickets.filter(t => t.status === 'PAID').length
  const inTransitCount = recentParcels.filter(p => p.status === 'IN_TRANSIT').length
  const totalSpent = recentTickets.reduce((sum, t) => sum + (t.journey?.price || 0), 0)

  const statusLabel = (s: string) =>
    s === 'PAID' ? 'Upcoming' : s === 'COMPLETED' ? 'Completed' : s === 'CANCELLED' ? 'Cancelled' : s

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-ink-900 to-ink-700 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-flame-600/30 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
          </h1>
          <p className="mt-1 max-w-md text-white/70">
            {upcomingCount > 0 || inTransitCount > 0
              ? `You have ${upcomingCount} upcoming trip${upcomingCount !== 1 ? 's' : ''} and ${inTransitCount} parcel${inTransitCount !== 1 ? 's' : ''} in transit.`
              : 'Ready for your next journey?'}
          </p>
          <Link to="/search" className="btn mt-5 bg-white text-ink-900 hover:bg-white/90">
            <Plus className="h-4 w-4" /> Book a Trip
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon={Ticket} label="Total Trips" value={String(recentTickets.length)} hint={`${upcomingCount} upcoming`} />
            <Stat icon={Package} label="Parcels Sent" value={String(recentParcels.length)} hint={`${inTransitCount} in transit`} />
            <Stat icon={Wallet} label="Total Spent" value={rwf(totalSpent)} hint="Lifetime" />
          </div>

          {/* Recent Trips */}
          <Section title="Recent Trips" to="/dashboard/trips">
            {recentTickets.length > 0 ? (
              <div className="divide-y divide-ink-100">
                {recentTickets.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-50 text-ink-900">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink-900">
                        {t.journey?.sourceStation?.name || 'N/A'} → {t.journey?.destinationStation?.name || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-400">
                        <Calendar className="h-3 w-3" /> {new Date(t.journey?.departureTime || t.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-ink-900">{rwf(t.journey?.price || 0)}</span>
                    <span className={cn('chip', statusStyles[t.status] || 'bg-ink-100 text-ink-700')}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-ink-400">
                No trips yet.{' '}
                <Link to="/search" className="font-semibold text-flame-600">Book your first trip</Link>
              </p>
            )}
          </Section>

          {/* Recent Parcels */}
          <Section title="Recent Parcels" to="/dashboard/parcels">
            {recentParcels.length > 0 ? (
              <div className="divide-y divide-ink-100">
                {recentParcels.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-50 text-ink-900">
                      <Package className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink-900">
                        {p.journey?.sourceStation?.name || 'N/A'} → {p.journey?.destinationStation?.name || 'N/A'}
                      </div>
                      <div className="text-xs text-ink-400">{p.trackingCode}</div>
                    </div>
                    <span className={cn('chip', statusStyles[p.status] || 'bg-ink-100 text-ink-700')}>
                      {p.status === 'PENDING' ? 'Pending Pickup' : p.status === 'IN_TRANSIT' ? 'In Transit' : p.status === 'DELIVERED' ? 'Delivered' : p.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-ink-400">
                No parcels yet.{' '}
                <Link to="/send-parcel" className="font-semibold text-flame-600">Send a parcel</Link>
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Ticket; label: string; value: string; hint: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-2xl font-extrabold text-ink-900">{value}</div>
        <div className="text-sm text-ink-500">{label}</div>
        <div className="text-xs text-flame-600">{hint}</div>
      </div>
    </div>
  )
}

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold text-ink-900">{title}</h2>
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-flame-600 hover:gap-2">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </div>
  )
}
