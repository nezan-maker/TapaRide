import { useState, useEffect } from 'react'
import { api, ApiError } from '../../lib/api'
import VehicleRegistrationForm from '../../components/VehicleRegistrationForm'
import Fa from '../../components/Fa';

interface Agency {
  id: string
  name: string
  verified: boolean
  createdAt: string
  ownerId: string
}

interface Vehicle {
  id: string
  plateNumber: string
  model: string
  capacity: number
  driverId: string | null
}

export default function OwnerDashboard() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [agencyName, setAgencyName] = useState('')
  const [ruraCode, setRuraCode] = useState('')

  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [assignRole, setAssignRole] = useState<'MANAGER' | 'DRIVER'>('MANAGER')
  const [staffEmail, setStaffEmail] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showVehicleForm, setShowVehicleForm] = useState(false)

  useEffect(() => {
    fetchAgencies()
  }, [])

  const fetchAgencies = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, vehicleData] = await Promise.all([
        api.get('/api/agencies'),
        api.get('/api/vehicles').catch(() => ({ vehicles: [] })),
      ])
      const list = data.items || data.agencies || data
      setAgencies(list)
      setVehicles(vehicleData.vehicles || vehicleData.items || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load agencies')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    if (!agencyName || !ruraCode) {
      setError('Please provide agency name and RURA code')
      return
    }
    try {
      await api.post('/api/agencies', { name: agencyName, ruraCode })
      setSuccessMsg(`Agency "${agencyName}" registered and activated`)
      setAgencyName('')
      setRuraCode('')
      setShowAddForm(false)
      fetchAgencies()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register agency')
    }
  }

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgency || !staffEmail) return
    setAssigning(true)
    setError(null)
    setSuccessMsg(null)

    const endpoint = assignRole === 'MANAGER'
      ? `/api/agencies/${selectedAgency.id}/assign-manager-by-email`
      : `/api/agencies/${selectedAgency.id}/assign-driver-by-email`

    const payload = assignRole === 'MANAGER'
      ? { email: staffEmail, stationId: '' } // stationId needed — pass empty for now
      : { email: staffEmail }

    try {
      // For managers, we need a stationId. If not provided, fallback to a station lookup.
      if (assignRole === 'MANAGER' && !payload.stationId) {
        // Try to find first station for this agency
        const agencyDetail = await api.get(`/api/agencies/${selectedAgency.id}`)
        const stations = agencyDetail.stations || []
        if (stations.length > 0) {
          payload.stationId = stations[0].id
        } else {
          setError('No stations found for this agency. Create a station first before assigning managers.')
          setAssigning(false)
          return
        }
      }

      await api.post(endpoint, payload)
      setSuccessMsg(`User ${staffEmail} assigned successfully as ${assignRole.toLowerCase()}`)
      setStaffEmail('')
      setSelectedAgency(null)
      fetchAgencies()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to assign ${assignRole.toLowerCase()}`)
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
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
          <h1 className="text-2xl font-extrabold sm:text-3xl">Agency Operations Center</h1>
          <p className="mt-1 text-white/70">
            Register new transport companies, verify RURA licenses, and manage executive staff assignments.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn bg-white text-ink-900 hover:bg-white/90 shrink-0"
        >
          <Fa name="plus" className="h-4 w-4" /> Register Agency
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {showAddForm && (
            <div className="card p-6 bg-ink-50 animate-fade-up">
              <h2 className="text-lg font-bold text-ink-900 mb-4">Register New Agency</h2>
              <form onSubmit={handleCreateAgency} className="space-y-4">
                <div>
                  <label className="label">Agency Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Kigali Express Bus"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">RURA License Code</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. REG-10293847"
                    value={ruraCode}
                    onChange={(e) => setRuraCode(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-ink-400">
                    Enter the document number from your RURA-issued Transport Operating License.
                    The number will be verified against the official RURA Licensing Portal.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn-outline py-2.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!ruraCode || !agencyName}
                    className="btn-primary py-2.5"
                  >
                    Register Agency
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-lg font-bold text-ink-900 mb-4">Registered Transport Agencies</h2>
            {agencies.length > 0 ? (
              <div className="space-y-4">
                {agencies.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl border border-ink-100 hover:border-ink-200 transition">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink-900">{a.name}</h3>
                        <p className="text-xs text-ink-400">ID: {a.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`chip ${a.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {a.verified ? (
                            <><Fa name="check" className="h-3 w-3" /> Verified by RURA</>
                          ) : (
                            'Pending RURA Verification'
                          )}
                        </span>
                        <button
                          onClick={() => setSelectedAgency(a)}
                          className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1.5"
                        >
                          <Fa name="userplus" className="h-3.5 w-3.5" /> Staff
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-400 text-center py-8">No agencies found. Register one to get started.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {selectedAgency ? (
            <div className="card p-6 bg-ink-50 border-flame-200">
              <h3 className="font-bold text-ink-900 mb-1">Assign Staff</h3>
              <p className="text-xs text-ink-500 mb-4">
                Agency: <span className="font-semibold text-ink-900">{selectedAgency.name}</span>
              </p>
              <form onSubmit={handleAssignStaff} className="space-y-4">
                <div>
                  <label className="label">Staff Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignRole('MANAGER')}
                      className={`btn text-xs py-2 ${assignRole === 'MANAGER' ? 'bg-ink-900 text-white' : 'btn-outline'}`}
                    >
                      Manager
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignRole('DRIVER')}
                      className={`btn text-xs py-2 ${assignRole === 'DRIVER' ? 'bg-ink-900 text-white' : 'btn-outline'}`}
                    >
                      Driver
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Staff Member Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="staff@email.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAgency(null)}
                    className="btn-outline flex-1 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning || !staffEmail}
                    className="btn-primary flex-1 py-2 text-xs"
                  >
                    {assigning ? 'Assigning...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card p-6 text-center text-ink-400 text-xs">
              Select an agency's "Staff" action to assign managers or drivers to it.
            </div>
          )}

          {selectedAgency && !showVehicleForm && (
            <button
              onClick={() => setShowVehicleForm(true)}
              className="btn-outline w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              <Fa name="bus" className="h-4 w-4" /> Register Vehicle
            </button>
          )}

          {selectedAgency && showVehicleForm && (
            <VehicleRegistrationForm
              agencyId={selectedAgency.id}
              onComplete={() => { setShowVehicleForm(false); setSuccessMsg('Vehicle registered successfully'); fetchAgencies() }}
              onCancel={() => setShowVehicleForm(false)}
            />
          )}

          {selectedAgency && vehicles.length > 0 && (
            <div className="card p-6 space-y-3">
              <h3 className="font-bold text-ink-900 text-sm flex items-center gap-2">
                <Fa name="bus" className="h-4 w-4 text-flame-600" /> Fleet ({vehicles.length})
              </h3>
              <div className="space-y-2">
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                    <div>
                      <div className="font-semibold text-ink-900 text-sm">{v.plateNumber}</div>
                      <div className="text-xs text-ink-400">{v.model} · {v.capacity} seats</div>
                    </div>
                    {v.driverId ? (
                      <span className="chip bg-emerald-50 text-emerald-700">Assigned</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          // Assign the current user as driver for this vehicle
                          // In a real app, the owner would pick from a list of DRIVER-role users
                          if (!selectedAgency) return
                          try {
                            await api.post(`/api/vehicles/${v.id}/assign-driver`, { driverId: v.id })
                            setSuccessMsg(`Driver assigned to ${v.plateNumber}`)
                            fetchAgencies()
                          } catch (err) {
                            setError(err instanceof ApiError ? err.message : 'Failed to assign driver')
                          }
                        }}
                        className="btn-outline py-1 px-2.5 text-[11px] flex items-center gap-1"
                      >
                        <Fa name="user-plus" className="h-3 w-3" /> Assign Driver
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-ink-900 text-sm">System Status</h3>
            <div className="divide-y divide-ink-50">
              <div className="flex justify-between py-2 text-xs">
                <span className="text-ink-500">Total Registered Agencies</span>
                <span className="font-semibold text-ink-900">{agencies.length}</span>
              </div>
              <div className="flex justify-between py-2 text-xs">
                <span className="text-ink-500">RURA Verification</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Via licensing.rura.rw
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
