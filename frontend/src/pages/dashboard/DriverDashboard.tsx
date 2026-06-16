import { useState, useEffect } from 'react';
import { api, ApiError } from '../../lib/api';
import Fa from '../../components/Fa';
import { Skeleton, SkeletonHeader } from '../../components/Skeleton';

interface Station {
  id: string
  name: string
}

interface JourneyStop {
  id: string
  station: Station
  order: number
  reachedAt: string | null
}

interface Vehicle {
  id: string
  plateNumber: string
  model: string
  capacity: number
}

interface TicketUser {
  email: string
  phone: string
}

interface Ticket {
  id: string
  seatNumber: number
  status: string
  user: TicketUser
}

interface Journey {
  id: string
  sourceStation: Station
  destinationStation: Station
  departureTime: string
  price: number
  vehicle: Vehicle
  stops: JourneyStop[]
  tickets: Ticket[]
}

export default function DriverDashboard() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [boardingHash, setBoardingHash] = useState('')
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    fetchDriverData()
  }, [])

  const fetchDriverData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/journeys')
      const journeyList = data.journeys || data.items || data
      setJourneys(journeyList)
      if (journeyList.length > 0 && !activeJourney) {
        setActiveJourney(journeyList[0])
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to fetch driver schedules')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkStopReached = async (_stopId: string, stationId: string) => {
    if (!activeJourney) return
    setError(null)
    setSuccessMsg(null)
    try {
      await api.post(`/api/journeys/${activeJourney.id}/stops/reached`, { stationId })
      setSuccessMsg('Stop marked as reached successfully')
      setActiveJourney(prev => {
        if (!prev) return null
        return {
          ...prev,
          stops: prev.stops.map(stop =>
            stop.station.id === stationId ? { ...stop, reachedAt: new Date().toISOString() } : stop
          )
        }
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record stop completion')
    }
  }

  const handleConfirmAlighting = async (ticketId: string, stationId: string) => {
    if (!activeJourney) return
    setError(null)
    setSuccessMsg(null)
    try {
      // Find the ticket to get seatNumber
      const ticket = activeJourney.tickets.find(t => t.id === ticketId)
      await api.post(`/api/journeys/${activeJourney.id}/alight`, {
        ticketId,
        stationId: stationId || activeJourney.stops.find(s => s.reachedAt)?.station.id || activeJourney.sourceStation.id,
        seatNumber: ticket?.seatNumber || 0,
      })
      setSuccessMsg('Passenger alighted successfully')
      fetchDriverData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record alighting')
    }
  }

  const handleVerifyBoarding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!boardingHash) return
    setScanning(true)
    setScanResult(null)
    setScanError(null)
    try {
      const res = await api.post('/api/bulk-bookings/validate', {
        type: 'PASSENGER',
        boardingHash,
      })
      setScanResult(`Validated! Passenger ${res.passenger?.name || ''} boarded successfully.`)
      setBoardingHash('')
      fetchDriverData()
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : 'Invalid boarding hash or verification failure')
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonHeader />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton variant="title" width="1/2" />
                <Skeleton variant="chip" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton variant="text" />
                <Skeleton variant="text" />
                <Skeleton variant="text" />
              </div>
              <Skeleton variant="image" className="h-32" />
            </div>
            <div className="card p-6 space-y-3">
              <Skeleton variant="title" width="1/3" />
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} variant="pulse" className="h-12 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <Skeleton variant="title" width="2/3" />
              <div className="mt-3 space-y-2">
                <Skeleton variant="text" />
                <Skeleton variant="text" />
                <Skeleton variant="text" />
              </div>
            </div>
            <Skeleton variant="btn" className="w-full" />
            <Skeleton variant="btn" className="w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Find last reached stop for alighting reference
  const lastReachedStationId = activeJourney?.stops
    .filter(s => s.reachedAt)
    .sort((a, b) => new Date(b.reachedAt!).getTime() - new Date(a.reachedAt!).getTime())[0]?.station.id

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-ink-900 to-ink-700 p-6 text-white sm:p-8">
        <div className="relative">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Driver Dashboard</h1>
          <p className="mt-1 text-white/70">
            View assigned routes, record stops, and scan boarding manifests.
          </p>
        </div>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {activeJourney ? (
            <>
              <div className="card p-6">
                <div className="flex items-center justify-between border-b border-ink-50 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink-900">
                      {activeJourney.sourceStation?.name || 'N/A'} → {activeJourney.destinationStation?.name || 'N/A'}
                    </h2>
                    <p className="text-xs text-ink-400">Journey ID: {activeJourney.id}</p>
                  </div>
                  <span className="chip bg-flame-50 text-flame-700">Active Trip</span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                  <div className="flex items-center gap-2 text-ink-600">
                    <Fa name="calendar" className="h-4 w-4 text-flame-600" />
                    <span>{new Date(activeJourney.departureTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink-600">
                    <Fa name="clock" className="h-4 w-4 text-flame-600" />
                    <span>{new Date(activeJourney.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink-600">
                    <Fa name="users" className="h-4 w-4 text-flame-600" />
                    <span>Vehicle: {activeJourney.vehicle?.plateNumber || 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-bold text-ink-900 mb-4">Route Stop Progression</h3>
                  <div className="relative border-l-2 border-ink-100 ml-3 pl-6 space-y-6">
                    <div className="relative">
                      <span className="absolute -left-[31px] top-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-600 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-ink-900">{activeJourney.sourceStation?.name || 'Departure'}</p>
                          <p className="text-xs text-ink-400">Departure Station</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600">Departed</span>
                      </div>
                    </div>

                    {activeJourney.stops?.map((stop) => (
                      <div key={stop.id} className="relative">
                        <span className={`absolute -left-[31px] top-1.5 grid h-4 w-4 place-items-center rounded-full ring-4 ring-white ${stop.reachedAt ? 'bg-emerald-600' : 'bg-ink-200'}`} />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-ink-900">{stop.station?.name || 'Unknown'}</p>
                            <p className="text-xs text-ink-400">Stop #{stop.order}</p>
                          </div>
                          {stop.reachedAt ? (
                            <span className="text-xs font-semibold text-emerald-600">
                              Reached {new Date(stop.reachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkStopReached(stop.id, stop.station?.id || '')}
                              className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1"
                            >
                              <Fa name="play" className="h-3 w-3 text-flame-600 fill-flame-600" /> Mark Reached
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="relative">
                      <span className="absolute -left-[31px] top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ink-200 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-ink-900">{activeJourney.destinationStation?.name || 'Destination'}</p>
                          <p className="text-xs text-ink-400">Destination Terminus</p>
                        </div>
                        <span className="text-xs text-ink-400">Terminus</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-bold text-ink-900 mb-4">Boarded Passengers</h3>
                {activeJourney.tickets && activeJourney.tickets.length > 0 ? (
                  <div className="divide-y divide-ink-50">
                    {activeJourney.tickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-3.5">
                        <div>
                          <p className="font-semibold text-ink-900">Seat {t.seatNumber}</p>
                          <p className="text-xs text-ink-400">{t.user?.phone || 'N/A'} · {t.user?.email || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`chip ${t.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-600'}`}>
                            {t.status}
                          </span>
                          {t.status === 'PAID' && (
                            <button
                              onClick={() => handleConfirmAlighting(t.id, lastReachedStationId || '')}
                              className="btn-outline py-1.5 px-3 text-xs"
                            >
                              Confirm Alight
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400 text-center py-4">No ticketed passengers booked yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className="card p-8 text-center text-ink-400">
              No active journeys assigned.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6 bg-ink-50">
            <h3 className="font-bold text-ink-900 mb-2">Manifest Boarding Validation</h3>
            <p className="text-xs text-ink-500 mb-4">
              Enter the boarding hash from the passenger's cryptographic QR code or scan details.
            </p>
            <form onSubmit={handleVerifyBoarding} className="space-y-3">
              <div>
                <label className="label">Boarding Hash / QR Text</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. hash_cryptographic_code"
                  value={boardingHash}
                  onChange={(e) => setBoardingHash(e.target.value)}
                  disabled={scanning}
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full py-3 text-xs"
                disabled={scanning || !boardingHash}
              >
                {scanning ? 'Validating...' : 'Validate Boarding'}
              </button>
            </form>
            {scanResult && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                <Fa name="check" className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{scanResult}</span>
              </div>
            )}
            {scanError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-flame-50 p-3 text-xs text-flame-700">
                <Fa name="alert-circle" className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-ink-900 mb-4">Assigned Schedules</h3>
            {journeys.length > 0 ? (
              <div className="space-y-3">
                {journeys.map((j) => (
                  <div
                    key={j.id}
                    onClick={() => setActiveJourney(j)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${activeJourney?.id === j.id ? 'border-flame-600 bg-flame-50/20' : 'border-ink-100 hover:bg-ink-50'}`}
                  >
                    <div className="font-semibold text-ink-900 text-sm">
                      {j.sourceStation?.name || 'N/A'} → {j.destinationStation?.name || 'N/A'}
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      {new Date(j.departureTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div className="mt-1 text-[11px] text-flame-600">
                      Vehicle: {j.vehicle?.plateNumber || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-400 text-center py-4">No upcoming journeys scheduled.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
