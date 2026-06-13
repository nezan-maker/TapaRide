import { useState } from 'react'
import { Bus, AlertCircle, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/utils'

interface VehicleFormProps {
  agencyId: string
  onComplete: () => void
  onCancel: () => void
}

export default function VehicleRegistrationForm({ agencyId, onComplete, onCancel }: VehicleFormProps) {
  const [plateNumber, setPlateNumber] = useState('')
  const [model, setModel] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [rows, setRows] = useState(7)
  const [columns, setColumns] = useState(4)
  const [labelScheme, setLabelScheme] = useState<'alpha-numeric' | 'numeric'>('alpha-numeric')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAmenities = ['WiFi', 'AC', 'Charging', 'Restroom']
  const toggleAmenity = (a: string) => {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  const totalSeats = rows * columns

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!plateNumber || !model) {
      setError('Plate number and model are required.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/vehicles', {
        plateNumber,
        model,
        capacity: totalSeats,
        agencyId,
        amenities,
        seatLayout: { rows, columns, aisleAfterColumn: Math.floor(columns / 2), labelScheme, totalSeats },
      })
      onComplete()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register vehicle')
    } finally {
      setSubmitting(false)
    }
  }

  const seatNumberToLabel = (num: number) => {
    const idx = num - 1
    const r = Math.floor(idx / columns)
    const c = idx % columns
    if (labelScheme === 'numeric') return String(num)
    return `${String.fromCharCode(65 + r)}${c + 1}`
  }

  return (
    <div className="card p-6 bg-ink-50 border-flame-200 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ink-900 text-lg flex items-center gap-2">
          <Bus className="h-5 w-5 text-flame-600" /> Register New Vehicle
        </h3>
        <button onClick={onCancel} className="text-ink-300 hover:text-flame-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Plate Number</label>
            <input className="input" placeholder="RAB-123A" value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())} required />
          </div>
          <div>
            <label className="label">Model</label>
            <input className="input" placeholder="Toyota Coaster" value={model} onChange={e => setModel(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="label">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {allAmenities.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                  amenities.includes(a) ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'
                )}
              >
                {a === 'WiFi' ? '📶' : a === 'AC' ? '❄️' : a === 'Charging' ? '🔌' : '🚻'} {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Seat Layout</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold text-ink-500">Rows</label>
              <input type="number" className="input" min={1} max={20} value={rows} onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-500">Columns</label>
              <input type="number" className="input" min={1} max={10} value={columns} onChange={e => setColumns(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-500">Labels</label>
              <select className="input" value={labelScheme} onChange={e => setLabelScheme(e.target.value as any)}>
                <option value="alpha-numeric">A1, B2, ...</option>
                <option value="numeric">1, 2, 3, ...</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seat Preview */}
        <div>
          <label className="label">Seat Preview ({totalSeats} seats)</label>
          <div className="rounded-xl bg-white border border-ink-100 p-4">
            <div className="mb-3 flex justify-center">
              <div className="rounded-lg bg-ink-100 px-5 py-1 text-[10px] font-semibold text-ink-400">Driver</div>
            </div>
            <div
              className="grid gap-1.5 mx-auto max-w-xs"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: totalSeats }, (_, i) => {
                const seatNum = i + 1
                const label = seatNumberToLabel(seatNum)
                return (
                  <div
                    key={seatNum}
                    className="flex items-center justify-center rounded border border-ink-200 bg-white py-1.5 text-[10px] font-semibold text-ink-500"
                  >
                    {label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="btn-outline py-2.5">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary py-2.5 disabled:opacity-50">
            {submitting ? 'Registering...' : 'Register Vehicle'}
          </button>
        </div>
      </form>
    </div>
  )
}
