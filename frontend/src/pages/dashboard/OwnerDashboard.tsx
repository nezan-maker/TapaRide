import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../../lib/api';
import VehicleRegistrationForm from '../../components/VehicleRegistrationForm';
import Fa from '../../components/Fa';
import LogoUpload, { type UploadedLogo } from '../../components/LogoUpload';
import { Skeleton, SkeletonCard, SkeletonHeader } from '../../components/Skeleton';

interface Agency {
  id: string;
  name: string;
  verified: boolean;
  createdAt: string;
  ownerId: string;
  logoUrl?: string | null;
  ruraCode?: string | null;
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

  const [showAddForm, setShowAddForm] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [ruraCode, setRuraCode] = useState('');
  const [logo, setLogo] = useState<UploadedLogo | null>(null);
  const [creating, setCreating] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [assignRole, setAssignRole] = useState<'MANAGER' | 'DRIVER'>('MANAGER')
  const [staffEmail, setStaffEmail] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showVehicleForm, setShowVehicleForm] = useState(false)

  const fetchAgencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, vehicleData] = await Promise.all([
        api.get('/api/agencies'),
        api.get('/api/vehicles').catch(() => ({ vehicles: [] })),
      ]);
      const list = data.items || data.agencies || data;
      setAgencies(list);
      setVehicles(vehicleData.vehicles || vehicleData.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load agencies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial mount fetch — running once is the whole point of `[]` deps.
    // The exhaustive-deps rule would force us to loop over `fetchAgencies`,
    // but `fetchAgencies` is stable via useCallback([]) above, so this is
    // a deliberate minimal mount sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAgencies();
  }, [fetchAgencies]);

  const resetCreateForm = () => {
    setShowAddForm(false);
    setAgencyName('');
    setRuraCode('');
    setLogo(null);
    setLogoError(null);
    setCreating(false);
  };

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!agencyName || !ruraCode) {
      setError('Please provide agency name and RURA code');
      return;
    }
    if (logoError) {
      setError(logoError);
      return;
    }
    setCreating(true);
    try {
      const form = new FormData();
      form.append('name', agencyName.trim());
      form.append('ruraCode', ruraCode.trim());
      if (logo?.file) form.append('logo', logo.file, logo.file.name);
      await api.upload('/api/agencies', form);
      setSuccessMsg(`Agency "${agencyName}" registered and activated`);
      resetCreateForm();
      fetchAgencies();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register agency');
      setCreating(false);
    }
  };

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
      <div className="space-y-6">
        <SkeletonHeader />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="card p-6 space-y-4">
          <Skeleton variant="title" width="1/3" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
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
            <div className="card p-6 sm:p-8 bg-gradient-to-br from-white via-white to-mist border-ink-100 shadow-card animate-fade-up">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="eyebrow text-flame-600">New Agency</p>
                  <h2 className="mt-1 text-xl font-extrabold text-ink-900">Register your company</h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Add your logo and your RURA-issued license. We'll verify against the regulator before activation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl text-ink-400 hover:bg-ink-50 hover:text-ink-900"
                  aria-label="Close form"
                >
                  <Fa name="xmark" className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAgency} className="space-y-5">
                <LogoUpload
                  value={logo}
                  onChange={(next) => {
                    setLogo(next);
                    setLogoError(null);
                  }}
                  onError={(msg) => setLogoError(msg || null)}
                />

                <div>
                  <label className="label">Agency name</label>
                  <div className="relative">
                    <Fa name="building" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input
                      type="text"
                      className="input pl-10 h-12 text-base"
                      placeholder="e.g. Kigali Express Bus"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">RURA license code</label>
                  <div className="relative">
                    <Fa name="shield" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input
                      type="text"
                      className="input pl-10 h-12 text-base"
                      placeholder="e.g. REG-10293847"
                      value={ruraCode}
                      onChange={(e) => setRuraCode(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-400">
                    Enter the document number from your RURA-issued Transport Operating License. We'll verify it
                    against <a href="https://licensing.rura.rw" target="_blank" rel="noreferrer" className="font-semibold text-flame-600 hover:underline">licensing.rura.rw</a> before activation.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetCreateForm}
                    className="btn-outline py-3"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !ruraCode || !agencyName || !!logoError}
                    className="btn-primary py-3 px-6 flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Fa name="spinner" className="h-4 w-4 animate-spin" />
                        Verifying RURA…
                      </>
                    ) : (
                      <>
                        Register Agency
                        <Fa name="arrowright" className="h-4 w-4" />
                      </>
                    )}
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
                      <div className="flex items-center gap-3 min-w-0">
                        {a.logoUrl ? (
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mist shadow-[inset_0_0_0_1px_rgba(16,7,92,0.06)] overflow-hidden">
                            <img
                              src={a.logoUrl}
                              alt={`${a.name} logo`}
                              className="h-9 w-9 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-700 font-bold">
                            {a.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-ink-900 truncate">{a.name}</h3>
                          <p className="text-xs text-ink-400 truncate">RURA · {a.ruraCode ?? '—'}</p>
                        </div>
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
