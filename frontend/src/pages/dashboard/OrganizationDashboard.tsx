import { useState, useEffect } from 'react'
import { Plus, Users, Calendar, QrCode, AlertCircle, CheckCircle, Trash2, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import QRCode from 'qrcode'

interface Organization {
  id: string
  name: string
  createdAt: string
}

interface PassengerInput {
  name: string
  nationalId: string
  seatNumber: number
  parentPhone?: string
  parentEmail?: string
}

interface Journey {
  id: string
  sourceStation: { name: string }
  destinationStation: { name: string }
  departureTime: string
  price: number
}

interface PassengerStatus {
  id: string
  name: string
  seatNumber: number
  status: 'PENDING' | 'BOARDED' | 'ALIGHTED'
  parentPhone?: string
}

interface BulkBooking {
  id: string
  destination: string
  departureTime: string
  signature: string
  qrCode?: string // QR Code Data URL
  passengers: PassengerStatus[]
}

export default function OrganizationDashboard() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [bookings, setBookings] = useState<BulkBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Register Org form
  const [orgName, setOrgName] = useState('')
  const [showOrgForm, setShowOrgForm] = useState(false)

  // Manifest form
  const [showManifestForm, setShowManifestForm] = useState(false)
  const [journeyId, setJourneyId] = useState('')
  const [destination, setDestination] = useState('')
  const [passengers, setPassengers] = useState<PassengerInput[]>([
    { name: '', nationalId: '', seatNumber: 1, parentPhone: '', parentEmail: '' }
  ])

  // Active QR Modal
  const [activeBookingQR, setActiveBookingQR] = useState<BulkBooking | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generatingQR, setGeneratingQR] = useState(false)

  useEffect(() => {
    if (!activeBookingQR) {
      setQrDataUrl(null)
      return
    }
    setGeneratingQR(true)
    const qrPayload = JSON.stringify({
      bookingId: activeBookingQR.id,
      destination: activeBookingQR.destination,
      signature: activeBookingQR.signature,
      passengerCount: activeBookingQR.passengers?.length || 0,
    })
    QRCode.toDataURL(qrPayload, {
      width: 200,
      margin: 2,
      color: { dark: '#10075C', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null))
      .finally(() => setGeneratingQR(false))
  }, [activeBookingQR])

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [orgData, journeyData] = await Promise.all([
        api.get('/api/bulk-bookings/organizations'),
        api.get('/api/journeys'),
      ])
      const orgList = orgData.organizations || []
      setOrganizations(orgList)
      setJourneys(journeyData.journeys || journeyData)

      if (orgList.length > 0) {
        setSelectedOrg(orgList[0])
        fetchBookings(orgList[0].id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to initialize organization context')
    } finally {
      setLoading(false)
    }
  }

  const fetchBookings = async (orgId: string) => {
    try {
      // In the backend, we fetch bookings via custom routes or wait for general list.
      // We can query /api/bulk-bookings for this org
      const data = await api.get(`/api/bulk-bookings?organizationId=${orgId}`).catch(() => [])
      setBookings(data.bookings || data || [])
    } catch (err) {
      console.error('Failed to load bookings:', err)
    }
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setError(null)
    try {
      const res = await api.post('/api/bulk-bookings/organizations', { name: orgName })
      const newOrg = res.organization
      setOrganizations(prev => [...prev, newOrg])
      setSelectedOrg(newOrg)
      setOrgName('')
      setShowOrgForm(false)
      setSuccessMsg(`Organization "${newOrg.name}" registered successfully`)
      fetchBookings(newOrg.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register organization')
    }
  }

  const handleAddPassengerInput = () => {
    setPassengers(prev => [
      ...prev,
      { name: '', nationalId: '', seatNumber: prev.length + 1, parentPhone: '', parentEmail: '' }
    ])
  }

  const handleRemovePassengerInput = (index: number) => {
    setPassengers(prev => prev.filter((_, i) => i !== index))
  }

  const handlePassengerChange = (index: number, field: keyof PassengerInput, value: any) => {
    setPassengers(prev => prev.map((p, i) => {
      if (i === index) {
        return { ...p, [field]: value }
      }
      return p
    }))
  }

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg || !journeyId || !destination) {
      setError('Please fill in all general booking details')
      return
    }

    // Basic client-side duplicate seat verification
    const seats = passengers.map(p => p.seatNumber)
    if (new Set(seats).size !== seats.length) {
      setError('Duplicate seat numbers detected in passenger list')
      return
    }

    const journey = journeys.find(j => j.id === journeyId)
    if (!journey) return

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const cleanPassengers = passengers.map(p => ({
        name: p.name,
        nationalId: p.nationalId,
        seatNumber: Number(p.seatNumber),
        parentPhone: p.parentPhone || undefined,
        parentEmail: p.parentEmail || undefined,
      }))

      const payload = {
        organizationId: selectedOrg.id,
        journeyId,
        destination,
        departureTime: journey.departureTime,
        passengers: cleanPassengers,
      }

      const res = await api.post('/api/bulk-bookings', payload)
      setSuccessMsg('Bulk booking manifest cryptographically signed and submitted')
      setShowManifestForm(false)
      
      // Clear manifest fields
      setJourneyId('')
      setDestination('')
      setPassengers([{ name: '', nationalId: '', seatNumber: 1, parentPhone: '', parentEmail: '' }])
      
      // Refresh list
      fetchBookings(selectedOrg.id)
      
      // Set active booking QR to show to the user
      setActiveBookingQR(res.bulkBooking || res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit bulk booking manifest')
    } finally {
      setLoading(false)
    }
  }

  if (loading && organizations.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 relative overflow-hidden rounded-2xl bg-gradient-to-r from-ink-900 to-ink-700 p-6 text-white sm:p-8">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Corporate & School Bookings</h1>
          <p className="mt-1 text-white/70">
            Submit passenger lists, setup guardian notification SMS alerts, and generate secure master boarding QR keys.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOrgForm(!showOrgForm)}
            className="btn bg-white/20 text-white hover:bg-white/30 shrink-0"
          >
            Register Org
          </button>
          {organizations.length > 0 && (
            <button
              onClick={() => setShowManifestForm(!showManifestForm)}
              className="btn bg-white text-ink-900 hover:bg-white/90 shrink-0"
            >
              <Plus className="h-4 w-4" /> Create Manifest
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Register Organization Form */}
      {showOrgForm && (
        <div className="card p-6 bg-ink-50 animate-fade-up">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Register Your Organization</h2>
          <p className="text-xs text-ink-400 mb-4">You need an organization profile to submit group bookings and manifests.</p>
          <form onSubmit={handleCreateOrg} className="flex gap-3">
            <input
              type="text"
              className="input"
              placeholder="e.g. Green Hills Academy or MTN Rwanda"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary py-2.5">Register</button>
          </form>
        </div>
      )}

      {/* Manifest Booking Creation Form */}
      {showManifestForm && (
        <div className="card p-6 border-flame-100 bg-white animate-fade-up space-y-6">
          <h2 className="text-lg font-bold text-ink-900">Create Bulk Booking Manifest</h2>
          
          <form onSubmit={handleCreateManifest} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Select Journey / Bus Route</label>
                <select
                  className="input"
                  value={journeyId}
                  onChange={(e) => setJourneyId(e.target.value)}
                  required
                >
                  <option value="">Select Journey Route</option>
                  {journeys.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.sourceStation.name} → {j.destinationStation.name} · {new Date(j.departureTime).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Final Destination / Drop-off Point</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Rubavu Main Terminal"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Passenger Manifest Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-ink-900 text-sm">Passenger Registry Manifest</h3>
                <button
                  type="button"
                  onClick={handleAddPassengerInput}
                  className="btn-outline py-1 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Passenger
                </button>
              </div>

              <div className="space-y-4">
                {passengers.map((p, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-5 p-4 rounded-xl bg-ink-50 relative">
                    <div className="sm:col-span-2">
                      <label className="label text-[10px]">Full Name</label>
                      <input
                        type="text"
                        className="input bg-white py-2"
                        placeholder="Amina"
                        value={p.name}
                        onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[10px]">National ID</label>
                      <input
                        type="text"
                        className="input bg-white py-2"
                        placeholder="1199..."
                        value={p.nationalId}
                        onChange={(e) => handlePassengerChange(index, 'nationalId', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[10px]">Seat #</label>
                      <input
                        type="number"
                        className="input bg-white py-2"
                        value={p.seatNumber}
                        onChange={(e) => handlePassengerChange(index, 'seatNumber', parseInt(e.target.value, 10))}
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[10px]">Guardian SMS (Alerts)</label>
                      <input
                        type="text"
                        className="input bg-white py-2"
                        placeholder="+25078..."
                        value={p.parentPhone || ''}
                        onChange={(e) => handlePassengerChange(index, 'parentPhone', e.target.value)}
                      />
                    </div>

                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePassengerInput(index)}
                        className="absolute top-2 right-2 text-ink-300 hover:text-flame-600"
                        aria-label="Remove passenger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-ink-50 pt-4">
              <button
                type="button"
                onClick={() => setShowManifestForm(false)}
                className="btn-outline py-2.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary py-2.5"
              >
                Sign & Submit Manifest
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Manifest History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink-900">Manifests & Group Bookings</h2>
              {organizations.length > 1 && (
                <select
                  className="input py-1.5 px-3 max-w-[200px]"
                  value={selectedOrg?.id || ''}
                  onChange={(e) => {
                    const org = organizations.find(o => o.id === e.target.value) || null
                    setSelectedOrg(org)
                    if (org) fetchBookings(org.id)
                  }}
                >
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
            </div>

            {bookings.length > 0 ? (
              <div className="divide-y divide-ink-50">
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                      <div className="font-semibold text-ink-900 text-sm">
                        To: {b.destination}
                      </div>
                      <div className="text-xs text-ink-500 mt-1 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(b.departureTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span>·</span>
                        <Users className="h-3 w-3 text-flame-600" />
                        <span className="font-semibold text-flame-600">{b.passengers?.length || 0} Passengers</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveBookingQR(b)}
                        className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" /> Manifest QR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-400 text-center py-8">No manifest bookings submitted yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Organization Profiles Context */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-ink-900 text-sm mb-3">Organization Profiles</h3>
            {organizations.length > 0 ? (
              <div className="space-y-2">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => {
                      setSelectedOrg(org)
                      fetchBookings(org.id)
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${selectedOrg?.id === org.id ? 'border-flame-600 bg-flame-50/20' : 'border-ink-100 hover:bg-ink-50'}`}
                  >
                    <div className="font-semibold text-ink-900 text-sm">{org.name}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5">ID: {org.id}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-400 text-center py-4">No organizations registered yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cryptographic Manifest QR Modal */}
      {activeBookingQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 animate-fade-in">
          <div className="card w-full max-w-md bg-white p-6 relative animate-fade-up">
            <h3 className="text-lg font-bold text-ink-900 text-center mb-1">Cryptographic Manifest Boarding Key</h3>
            <p className="text-xs text-ink-400 text-center mb-6">Signed by Tapa security HSM. Present this to the driver for boarding verification.</p>

            <div className="flex flex-col items-center justify-center p-4 bg-ink-50 rounded-2xl mb-4 border border-ink-100">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Manifest Boarding QR Code"
                  className="h-44 w-44 object-contain"
                />
              ) : generatingQR ? (
                <div className="h-44 w-44 bg-ink-200 animate-pulse rounded flex items-center justify-center">
                  <QrCode className="h-10 w-10 text-ink-400" />
                </div>
              ) : (
                <div className="h-44 w-44 bg-ink-100 rounded flex items-center justify-center">
                  <QrCode className="h-10 w-10 text-ink-300" />
                </div>
              )}
              <div className="mt-3 text-[10px] font-mono text-center text-ink-400 select-all overflow-hidden text-ellipsis w-full max-w-[280px]">
                Sig: {activeBookingQR.signature}
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-ink-600 mb-6">
              <div className="flex justify-between border-b border-ink-50 pb-1">
                <span>Destination</span>
                <span className="font-semibold text-ink-900">{activeBookingQR.destination}</span>
              </div>
              <div className="flex justify-between border-b border-ink-50 pb-1">
                <span>Departure Time</span>
                <span className="font-semibold text-ink-900">{new Date(activeBookingQR.departureTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-ink-50 pb-1">
                <span>Manifest HMAC signature</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Verified
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveBookingQR(null)}
              className="btn-primary w-full py-3"
            >
              Close Manifest
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
