import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, ArrowLeftRight, Bus, Package, Search } from 'lucide-react'
import { cn } from '../lib/utils'
import { api } from '../lib/api'

export default function SearchWidget() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'bus' | 'parcel'>('bus')
  const [stations, setStations] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

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
          <Bus className="h-4 w-4" /> Bus Tickets
        </button>
        <button
          type="button"
          onClick={() => setTab('parcel')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition',
            tab === 'parcel' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-400',
          )}
        >
          <Package className="h-4 w-4" /> Send Parcel
        </button>
      </div>

      {tab === 'bus' ? (
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">From</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  className="input pl-9 appearance-none"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select city</option>
                  {availableFrom.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={swap}
              className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-100 text-ink-400 hover:bg-ink-50"
              aria-label="Swap cities"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <label className="label">To</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  className="input pl-9 appearance-none"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select city</option>
                  {availableTo.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Travel date</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="date"
                className="input pl-9"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-3.5">
            <Search className="h-4 w-4" /> Search Buses
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            navigate(`/send-parcel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
          }}
          className="space-y-4"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">From</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  className="input pl-9 appearance-none"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select city</option>
                  {availableFrom.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={swap}
              className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-100 text-ink-400 hover:bg-ink-50"
              aria-label="Swap cities"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <label className="label">To</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  className="input pl-9 appearance-none"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select city</option>
                  {availableTo.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-outline w-full py-3.5">
            <Package className="h-4 w-4" /> Send a Parcel
          </button>
        </form>
      )}
    </div>
  )
}
