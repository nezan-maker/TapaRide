import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '../lib/utils'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import Fa from './Fa';
import Select from './Select';

export default function SearchWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'bus' | 'parcel'>('bus')
  const [stations, setStations] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const canSubmit = from.length > 0 && to.length > 0 && from !== to

  useEffect(() => {
    fetchStations()
  }, [])

  const fetchStations = async () => {
    try {
      const data = await api.get('/api/stations')
      const list = data.stations || data.items || data
      const names = Array.isArray(list) ? list.map((s: any) => s.name || s) : []
      setStations(names.length > 0 ? names : ['Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)', 'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi'])
    } catch {
      // Fallback to default cities
      setStations(['Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)', 'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi'])
    } finally {
      setLoading(false)
    }
  }

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to) return
    navigate(`/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`)
  }

  // The "Send Parcel" form is the start of a transactional flow. We let
  // anyone fill the form (good for marketing — "see what it would cost")
  // but the final submit is gated: if the user isn't logged in we
  // forward them to /login with the intended destination preserved so
  // they bounce back here after sign-in.
  const handleSendParcel = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to) return
    const target = `/send-parcel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    if (authLoading) return  // wait for the auth check to settle
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/send-parcel', search: location.search } } })
      return
    }
    navigate(target)
  }

  const availableFrom = stations.filter((s) => s !== to)
  const availableTo = stations.filter((s) => s !== from)

  return (
    <div className="card w-full p-5 sm:p-6">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-ink-50 p-1">
        <button
          type="button"
          onClick={() => setTab('bus')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition',
            tab === 'bus' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-400',
          )}
        >
          <Fa name="bus" className="h-4 w-4" /> Bus Tickets
        </button>
        <button
          type="button"
          onClick={() => setTab('parcel')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition',
            tab === 'parcel' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-400',
          )}
        >
          <Fa name="package" className="h-4 w-4" /> Send Parcel
        </button>
      </div>

      {tab === 'bus' ? (
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label="From"
                options={[{ value: '', label: 'Select city' }, ...availableFrom.map((c) => ({ value: c, label: c }))]}
                value={from}
                onChange={(v) => setFrom(v)}
                disabled={loading}
              />
            </div>
            <button
              type="button"
              onClick={swap}
              className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-100 text-ink-400 hover:bg-ink-50"
              aria-label="Swap cities"
            >
              <Fa name="arrowleftright" className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <Select
                label="To"
                options={[{ value: '', label: 'Select city' }, ...availableTo.map((c) => ({ value: c, label: c }))]}
                value={to}
                onChange={(v) => setTo(v)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="label">Travel date</label>
            <div className="relative">
              <Fa name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="date"
                className="input pl-9 pr-9"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Fa name="calendar" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-200" />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Fa name="search" className="h-4 w-4" />
            {canSubmit ? 'Search Buses' : 'Select from and to continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendParcel} className="space-y-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-400">
            <Fa name="lock" className="h-3 w-3" />
            You'll be asked to sign in before sending.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label="From"
                options={[{ value: '', label: 'Select city' }, ...availableFrom.map((c) => ({ value: c, label: c }))]}
                value={from}
                onChange={(v) => setFrom(v)}
                disabled={loading}
              />
            </div>
            <button
              type="button"
              onClick={swap}
              className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-100 text-ink-400 hover:bg-ink-50"
              aria-label="Swap cities"
            >
              <Fa name="arrowleftright" className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <Select
                label="To"
                options={[{ value: '', label: 'Select city' }, ...availableTo.map((c) => ({ value: c, label: c }))]}
                value={to}
                onChange={(v) => setTo(v)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn-outline w-full py-3.5">
            <Fa name="package" className="h-4 w-4" /> Send a Parcel
          </button>
        </form>
      )}
    </div>
  )
}
