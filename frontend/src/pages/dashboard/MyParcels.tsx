import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn, rwf } from '../../lib/utils';
import { api, ApiError } from '../../lib/api';
import Fa from '../../components/Fa';
import { Skeleton, SkeletonListItem, SkeletonHeader } from '../../components/Skeleton';

interface Parcel {
  id: string
  trackingCode: string
  receiverName: string
  receiverPhone: string
  status: string
  weight: number | null
  fee: number | null
  notes: string | null
  createdAt: string
  journey?: {
    sourceStation?: { name: string }
    destinationStation?: { name: string }
  }
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_TRANSIT: 'bg-flame-100 text-flame-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
}

export default function MyParcels() {
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchParcels()
  }, [])

  const fetchParcels = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/parcels/my')
      const list = data.items || data.parcels || data
      setParcels(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load parcels')
    } finally {
      setLoading(false)
    }
  }

  const statusLabel = (s: string) =>
    s === 'PENDING' ? 'Pending Pickup' : s === 'IN_TRANSIT' ? 'In Transit' : s === 'DELIVERED' ? 'Delivered' : s

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">My Parcels</h1>
          <p className="text-ink-500">Track and manage all your shipments.</p>
        </div>
        <Link to="/send-parcel" className="btn-primary">
          <Fa name="plus" className="h-4 w-4" /> Send Parcel
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonHeader />
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      ) : parcels.length > 0 ? (
        <div className="grid gap-4">
          {parcels.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-900">
                    <Fa name="package" className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-bold text-ink-900">
                      {p.journey?.sourceStation?.name || 'N/A'} → {p.journey?.destinationStation?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-ink-400">
                      {p.trackingCode} · To: {p.receiverName}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-400">
                      {p.weight != null && <span>📦 {p.weight} kg</span>}
                      {p.fee != null && <span>💰 {rwf(p.fee)}</span>}
                    </div>
                    {p.notes && (
                      <div className="mt-1 text-xs text-ink-400 italic">{p.notes}</div>
                    )}
                  </div>
                </div>
                <span className={cn('chip', statusStyles[p.status] || 'bg-ink-100 text-ink-700')}>
                  {statusLabel(p.status)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-ink-400">
                  Sent {new Date(p.createdAt).toLocaleDateString()}
                </div>
                <Link
                  to={`/track?code=${p.trackingCode}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-flame-600 hover:gap-2"
                >
                  Track <Fa name="arrow-right" className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-ink-400">
          No parcels yet.
          <br />
          <Link to="/send-parcel" className="mt-2 inline-block font-semibold text-flame-600">
            Send a parcel
          </Link>
        </div>
      )}
    </div>
  )
}
