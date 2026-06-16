import { useState, useEffect } from 'react';
import { api, ApiError } from '../../lib/api';
import { rwf } from '../../lib/utils';
import Fa from '../../components/Fa';
import { Skeleton, SkeletonHeader, SkeletonStat } from '../../components/Skeleton';

interface Station {
  id: string
  name: string
  location: string
}

interface Vehicle {
  id: string
  plateNumber: string
  model: string
  capacity: number
}

interface Journey {
  id: string
  sourceStation: Station
  destinationStation: Station
  departureTime: string
  price: number
  vehicle: Vehicle
  tickets: any[]
}

export default function ManagerDashboard() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form states for creating a new journey
  const [showAddForm, setShowAddForm] = useState(false)
  const [sourceStationId, setSourceStationId] = useState('')
  const [destinationStationId, setDestinationStationId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [price, setPrice] = useState('')

  useEffect(() => {
    fetchManagerData()
  }, [])

  const fetchManagerData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [journeyData, stationData, vehicleData] = await Promise.all([
        api.get('/api/journeys'),
        api.get('/api/stations'),
        api.get('/api/vehicles'),
      ])
      
      setJourneys(journeyData.journeys || journeyData)
      setStations(stationData.stations || stationData)
      setVehicles(vehicleData.vehicles || vehicleData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to fetch manager data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!sourceStationId || !destinationStationId || !vehicleId || !departureTime || !price) {
      setError('Please fill in all fields')
      return
    }

    try {
      await api.post('/api/journeys', {
        sourceStationId,
        destinationStationId,
        vehicleId,
        departureTime: new Date(departureTime).toISOString(),
        price: parseInt(price, 10),
      })

      setSuccessMsg('Journey successfully created and driver notified')
      setShowAddForm(false)
      
      // Clear form
      setSourceStationId('')
      setDestinationStationId('')
      setVehicleId('')
      setDepartureTime('')
      setPrice('')

      // Refresh list
      fetchManagerData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to schedule journey')
    }
  }

  /**
   * Mark a stop as reached on an active journey. The backend endpoint is
   * `POST /api/journeys/:id/stops/reached` with `{ stationId }`.
   *
   * The listJourneys payload only ships station IDs for source and destination,
   * so the manager UI exposes two compact "Reached source / Reached destination"
   * buttons per row — enough to drive the live-tracking socket events.
   */
  const [marking, setMarking] = useState<string | null>(null);
  const handleMarkStopReached = async (journeyId: string, stationId: string, label: string) => {
    setMarking(`${journeyId}:${stationId}`);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.post(`/api/journeys/${journeyId}/stops/reached`, { stationId });
      setSuccessMsg(`Marked “${label}” as reached. Passengers have been notified.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record stop');
    } finally {
      setMarking(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonHeader />
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-6 space-y-4">
            <Skeleton variant="title" width="1/3" />
            <div className="space-y-3">
              <Skeleton variant="pulse" className="h-14 rounded-xl" />
              <Skeleton variant="pulse" className="h-14 rounded-xl" />
              <Skeleton variant="pulse" className="h-14 rounded-xl" />
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <Skeleton variant="title" width="1/2" />
            <div className="space-y-3">
              <Skeleton variant="pulse" className="h-14 rounded-xl" />
              <Skeleton variant="pulse" className="h-14 rounded-xl" />
              <Skeleton variant="pulse" className="h-14 rounded-xl" />
            </div>
          </div>
        </div>
        <Skeleton variant="btn" width="1/4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 relative overflow-hidden rounded-2xl bg-gradient-to-r from-ink-900 to-ink-700 p-6 text-white sm:p-8">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Operations Manager</h1>
          <p className="mt-1 text-white/70">
            Schedule inter-city routes, assign vehicles, and monitor booking capacities.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn bg-white text-ink-900 hover:bg-white/90 shrink-0"
        >
          <Fa name="plus" className="h-4 w-4" /> Schedule Journey
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Fa name="checkcircle" className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Schedule Journey Form */}
      {showAddForm && (
        <div className="card p-6 bg-ink-50 animate-fade-up">
          <h2 className="text-lg font-bold text-ink-900 mb-4">Schedule a New Journey</h2>
          <form onSubmit={handleCreateJourney} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Source Station</label>
              <select
                className="input"
                value={sourceStationId}
                onChange={(e) => setSourceStationId(e.target.value)}
              >
                <option value="">Select Station</option>
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Destination Station</label>
              <select
                className="input"
                value={destinationStationId}
                onChange={(e) => setDestinationStationId(e.target.value)}
              >
                <option value="">Select Station</option>
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Assign Vehicle</label>
              <select
                className="input"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">Select Vehicle</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plateNumber} — {v.model} (Cap: {v.capacity})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Departure Time</label>
              <input
                type="datetime-local"
                className="input"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Ticket Price (RWF)</label>
              <div className="relative">
                <Fa name="dollarsign" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="number"
                  className="input pl-9"
                  placeholder="e.g. 5000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-outline py-2.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary py-2.5"
              >
                Create Journey
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white">
            <Fa name="calendar" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-2xl font-extrabold text-ink-900">{journeys.length}</div>
            <div className="text-sm text-ink-500 font-medium">Scheduled Trips</div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white">
            <Fa name="users" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-2xl font-extrabold text-ink-900">
              {journeys.reduce((sum, j) => sum + (j.tickets?.length || 0), 0)}
            </div>
            <div className="text-sm text-ink-500 font-medium">Tickets Sold</div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white">
            <Fa name="map-pin" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-2xl font-extrabold text-ink-900">{stations.length}</div>
            <div className="text-sm text-ink-500 font-medium">Active Stations</div>
          </div>
        </div>
      </div>

      {/* Journeys List */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-ink-900 mb-4">Current Schedules & Bookings</h2>
        {journeys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-ink-100 text-xs font-bold uppercase tracking-wider text-ink-400">
                  <th className="py-3 px-2">Route</th>
                  <th className="py-3 px-2">Date & Time</th>
                  <th className="py-3 px-2">Vehicle</th>
                  <th className="py-3 px-2">Price</th>
                  <th className="py-3 px-2 text-right">Capacity</th>
                  <th className="py-3 px-2 text-right">Live status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {journeys.map((j) => {
                  const bookedCount = j.tickets?.length || 0;
                  const capacity = j.vehicle?.capacity || 30;
                  const fillPercentage = Math.round((bookedCount / capacity) * 100);
                  
                  return (
                    <tr key={j.id} className="text-sm text-ink-900 hover:bg-ink-50/50">
                      <td className="py-3.5 px-2 font-semibold">
                        {j.sourceStation?.name} → {j.destinationStation?.name}
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="flex flex-col">
                          <span>{new Date(j.departureTime).toLocaleDateString()}</span>
                          <span className="text-xs text-ink-400">
                            {new Date(j.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="font-mono text-xs text-flame-700 bg-flame-50 px-2 py-1 rounded">
                          {j.vehicle?.plateNumber || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 font-semibold">{rwf(j.price)}</td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className="font-semibold">{bookedCount} / {capacity} seats</span>
                          <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-ink-100">
                            <div
                              style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                              className={`h-full rounded-full ${fillPercentage > 90 ? 'bg-flame-600' : 'bg-emerald-600'}`}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="inline-flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkStopReached(
                                j.id,
                                j.sourceStation.id,
                                `${j.sourceStation.name} departure`,
                              )
                            }
                            disabled={marking === `${j.id}:${j.sourceStation.id}`}
                            className="btn-outline py-1 px-2.5 text-[11px] disabled:opacity-50"
                          >
                            <Fa name="play" className="h-3 w-3" />
                            {marking === `${j.id}:${j.sourceStation.id}`
                              ? 'Marking…'
                              : 'Reached source'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkStopReached(
                                j.id,
                                j.destinationStation.id,
                                `${j.destinationStation.name} arrival`,
                              )
                            }
                            disabled={marking === `${j.id}:${j.destinationStation.id}`}
                            className="btn-primary py-1 px-2.5 text-[11px] disabled:opacity-50"
                          >
                            <Fa name="flag-checkered" className="h-3 w-3" />
                            {marking === `${j.id}:${j.destinationStation.id}`
                              ? 'Marking…'
                              : 'Reached destination'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-400 text-center py-8">No journeys scheduled yet. Click "Schedule Journey" to begin.</p>
        )}
      </div>

      {/* Assign Driver */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-ink-900 mb-4">Assign a Driver</h2>
        <p className="text-sm text-ink-500 mb-3">
          Enter the email of a user to assign them as a driver to this agency. If they
          don't have an account yet, they'll receive an invitation email.
        </p>
        <AssignDriverForm />
      </div>
    </div>
  )
}

function AssignDriverForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setBusy(true)
    setResult(null)
    try {
      // The manager's managed agency is available from their auth context.
      // We call the existing assign-driver-by-email endpoint which the backend
      // now allows for MANAGER role too.
      const res = await api.post('/api/agencies/assign-driver', { email })
      setResult({ kind: 'success', message: res.message || `Invitation sent to ${email}` })
      setEmail('')
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof ApiError ? err.message : 'Failed to assign driver' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="email"
        className="input flex-1"
        placeholder="driver@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
        required
      />
      <button type="submit" disabled={busy || !email} className="btn-primary shrink-0 disabled:opacity-50">
        {busy ? 'Sending…' : 'Assign Driver'}
      </button>
      {result && (
        <span className={`flex items-center gap-1.5 text-sm ${result.kind === 'success' ? 'text-emerald-600' : 'text-flame-600'}`}>
          <Fa name={result.kind === 'success' ? 'check' : 'alert-circle'} className="h-4 w-4" />
          {result.message}
        </span>
      )}
    </form>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
