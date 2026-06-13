import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import Fa from '../components/Fa';

export default function Waitlist() {
  const [searchParams] = useSearchParams()
  const journeyId = searchParams.get('journeyId') || ''

  const [joined, setJoined] = useState(false)
  const [seatOpen, setSeatOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    if (!journeyId) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/waitlist', { journeyId })
      setJoined(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join waitlist')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-mist py-10">
      <div className="container-page">
        <div className="mx-auto max-w-md">
          <h1 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-ink-900">
            <Fa name="users" className="h-5 w-5 text-flame-600" /> Journey Waitlist
          </h1>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
              <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {seatOpen ? (
            <SeatOpened />
          ) : (
            <BusFull
              joined={joined}
              loading={loading}
              onJoin={handleJoin}
              onSeatOpen={() => setSeatOpen(true)}
            />
          )}

          {!journeyId && (
            <div className="card p-6 text-center text-ink-400 text-sm">
              <Fa name="users" className="mx-auto h-8 w-8 text-ink-200 mb-2" />
              <p>No journey selected. Search for a trip and join the waitlist if a bus is full.</p>
              <Link to="/search" className="btn-primary mt-4 inline-flex">
                Search Trips
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BusFull({
  joined,
  loading,
  onJoin,
  onSeatOpen,
}: {
  joined: boolean
  loading: boolean
  onJoin: () => void
  onSeatOpen: () => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-ink-900 to-ink-700 p-6 text-white text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10">
          <Fa name="users" className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold">Bus is full</h2>
        <p className="mt-1 text-white/70 text-sm">
          All seats have been booked for this trip. Join the waitlist to get notified if a seat becomes available.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {joined ? (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
              <Fa name="bellring" className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">You're on the waitlist!</div>
                <p className="text-emerald-600 text-xs mt-0.5">
                  We'll notify you immediately when a seat opens up. You'll have 10 minutes to claim it.
                </p>
              </div>
            </div>
            <button
              onClick={onSeatOpen}
              className="btn-primary w-full"
            >
              Simulate: Seat opened <Fa name="chevronright" className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
              <Fa name="zap" className="h-5 w-5 shrink-0" />
              <span className="font-medium">Real-time seat release notifications</span>
            </div>
            <button
              onClick={onJoin}
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Waitlist'}
            </button>
            <Link to="/search" className="btn-outline w-full">
              Find another trip
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function SeatOpened() {
  return (
    <div className="card p-6 text-center animate-fade-in">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <Fa name="ticket" className="h-8 w-8" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-ink-900">Seat opened up!</h2>
      <p className="mt-2 text-sm text-ink-500">
        A seat has become available due to a cancellation. You have 10 minutes to claim it.
      </p>
      <div className="mt-6 flex gap-3 justify-center">
        <Link to="/booking" className="btn-primary">
          <Fa name="ticket" className="h-4 w-4" /> Claim Seat
        </Link>
        <Link to="/search" className="btn-outline">
          Skip
        </Link>
      </div>
    </div>
  )
}
