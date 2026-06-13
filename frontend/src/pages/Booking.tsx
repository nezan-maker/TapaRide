import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  Bus,
  MapPin,
  Calendar,
  Tag,
  ArrowRight,
  User,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import Stepper from '../components/Stepper'
import { cn, rwf } from '../lib/utils'
import { api, ApiError } from '../lib/api'

interface JourneyAvailability {
  journeyId: string
  journey: {
    id: string
    departureTime: string
    price: number
    sourceStation: { id: string; name: string; location: string }
    destinationStation: { id: string; name: string; location: string }
    vehicle: { id: string; plateNumber: string; model: string; capacity: number; amenities?: string[]; seatLayout?: any }
  }
  totalCapacity: number
  bookedSeats: number[]
  availableSeats: number[]
}

const PRICE_PER_SEAT = 3500
const SERVICE_FEE = 200

export default function Booking() {
  const [searchParams] = useSearchParams()
  const journeyId = searchParams.get('journeyId') || ''

  const [availability, setAvailability] = useState<JourneyAvailability | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [purchasedTickets, setPurchasedTickets] = useState<Array<{ seatNumber: number; ticketId: string }>>([])
  const [paymentMode, setPaymentMode] = useState<'wallet' | 'card'>('wallet')

  useEffect(() => {
    if (journeyId) fetchAvailability()
  }, [journeyId])

  const fetchAvailability = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/api/journeys/${journeyId}/availability`)
      setAvailability(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load journey')
    } finally {
      setLoading(false)
    }
  }

  const toggleSeat = (seat: number) => {
    if (!availability) return
    if (availability.bookedSeats.includes(seat)) return
    setSelectedSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat],
    )
  }

  const total = useMemo(
    () => selectedSeats.length * (availability?.journey?.price || PRICE_PER_SEAT) + (selectedSeats.length ? SERVICE_FEE : 0),
    [selectedSeats.length, availability],
  )

  const handleBuy = async () => {
    if (selectedSeats.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      // Card payment path: create + confirm payment intent first
      if (paymentMode === 'card') {
        const intent = await api.post('/api/payments/create-intent', {
          amount: total,
          currency: 'rwf',
          journeyId,
          seatNumbers: selectedSeats,
          paymentMethod: 'card',
        })
        // Confirm the payment (in mock mode this simulates success)
        await api.post('/api/payments/confirm', {
          paymentIntentId: intent.id,
          journeyId,
          seatNumbers: selectedSeats,
        })
      }

      // Buy tickets (wallet payment, or post-card-payment)
      const tickets: Array<{ seatNumber: number; ticketId: string }> = []
      for (const seat of selectedSeats) {
        const res = await api.post('/api/tickets', {
          journeyId,
          seatNumber: seat,
          walletPassword: paymentMode === 'wallet' ? undefined : '',
        })
        tickets.push({ seatNumber: seat, ticketId: res.ticket?.id || res.id || 'pending' })
      }
      setPurchasedTickets(tickets)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to complete booking')
    } finally {
      setSubmitting(false)
    }
  }

  if (!journeyId) {
    return (
      <div className="bg-mist pb-16 pt-20 text-center">
        <div className="container-page">
          <Bus className="mx-auto h-12 w-12 text-ink-200" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">No journey selected</h2>
          <p className="mt-2 text-ink-500">Please search for a trip and select a journey to book.</p>
          <Link to="/search" className="btn-primary mt-6 inline-flex">
            Search Trips
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    const dep = availability?.journey
    return (
      <div className="bg-mist pb-16">
        <div className="border-b border-ink-100 bg-white py-5">
          <div className="container-page">
            <Stepper steps={['Select Bus', 'Select Seat', 'Payment', 'Confirmation']} current={3} />
          </div>
        </div>
        <div className="container-page py-12">
          <div className="mx-auto max-w-lg text-center">
            <span className="mx-auto grid h-16 w-16 animate-fade-in place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle className="h-8 w-8" />
            </span>
            <h1 className="mt-5 text-3xl font-extrabold text-ink-900">Booking confirmed!</h1>
            <p className="mt-2 text-ink-500">
              Your seats are reserved. We've sent your e-ticket and trip details to your phone and email.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-lg">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between bg-ink-900 p-5 text-white">
                <div className="flex items-center gap-2">
                  <TicketIcon className="h-5 w-5" />
                  <span className="font-bold">E-Ticket</span>
                </div>
                <span className="text-xs text-white/60">#{purchasedTickets[0]?.ticketId?.slice(0, 8) || 'NEW'}</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-flame-600" />
                  <span className="font-semibold text-ink-900">{dep?.sourceStation?.name || 'N/A'}</span>
                  <ArrowRight className="h-3 w-3 text-ink-300" />
                  <span className="font-semibold text-ink-900">{dep?.destinationStation?.name || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Calendar className="h-4 w-4" />
                  <span>{dep?.departureTime ? new Date(dep.departureTime).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-ink-400" />
                  <span className="text-ink-500">Seats:</span>
                  <span className="font-bold text-ink-900">{purchasedTickets.map(t => t.seatNumber).join(', ')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <Tag className="h-4 w-4 text-flame-600" /> Total: {rwf(total)}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Link to="/dashboard/trips" className="btn-primary flex-1">View My Trips</Link>
              <Link to="/search" className="btn-outline flex-1">Book Another</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const dep = availability?.journey
  const cap = availability?.totalCapacity || 30
  const seatLayout = availability?.journey?.vehicle?.seatLayout
  const columns = seatLayout?.columns || 4

  // Map seat numbers (1-indexed) to labels
  const seatNumberToLabel = (num: number) => {
    const idx = num - 1
    const r = Math.floor(idx / columns)
    const c = idx % columns
    if (seatLayout?.labelScheme === 'numeric') {
      return String(num)
    }
    return `${String.fromCharCode(65 + r)}${c + 1}`
  }

  return (
    <div className="bg-mist pb-16">
      <div className="border-b border-ink-100 bg-white py-5">
        <div className="container-page">
          <Stepper steps={['Select Bus', 'Select Seat', 'Payment', 'Confirmation']} current={1} />
        </div>
      </div>

      {dep && (
        <div className="bg-ink-900 text-white">
          <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
            <Link to="/search" className="flex items-center gap-1.5 font-semibold text-white/80 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back to Results
            </Link>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />
            <span className="flex items-center gap-2 font-semibold">
              <Bus className="h-4 w-4" /> {dep.sourceStation?.name || 'N/A'} → {dep.destinationStation?.name || 'N/A'}
            </span>
            <span className="text-white/60">·</span>
            <span>{dep.vehicle?.plateNumber || 'N/A'}</span>
          </div>
        </div>
      )}

      <div className="container-page py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md">
            <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchAvailability} className="btn-outline mt-4 w-full">
              Retry
            </button>
          </div>
        ) : availability ? (
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* Seat Map */}
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-bold text-ink-900">Select your seats</h2>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-ink-200 bg-white" /> Available</span>
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-ink-200" /> Booked</span>
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-ink-900" /> Selected</span>
                  </div>
                </div>

                <div className="mx-auto max-w-sm">
                  {/* Driver cab */}
                  <div className="mb-6 flex justify-center">
                    <div className="rounded-xl bg-ink-100 px-6 py-2 text-xs font-semibold text-ink-400">
                      Driver
                    </div>
                  </div>

                  {/* Seat grid */}
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: cap }, (_, i) => {
                      const seatNum = i + 1
                      const isBooked = availability.bookedSeats.includes(seatNum)
                      const isSelected = selectedSeats.includes(seatNum)
                      const label = seatNumberToLabel(seatNum)

                      return (
                        <button
                          key={seatNum}
                          onClick={() => toggleSeat(seatNum)}
                          disabled={isBooked || submitting}
                          className={cn(
                            'flex items-center justify-center rounded-lg border py-2 text-xs font-semibold transition',
                            isBooked && 'bg-ink-100 text-ink-300 border-ink-100 cursor-not-allowed',
                            isSelected && 'bg-ink-900 text-white border-ink-900',
                            !isBooked && !isSelected && 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-ink-50',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6 text-center text-xs text-ink-400">
                  {availability.availableSeats.length} of {cap} seats available
                </div>
              </div>

              {/* Booking Summary */}
              <div className="card p-6 h-fit sticky top-24">
                <h2 className="font-bold text-ink-900 mb-4">Booking Summary</h2>

                {dep && (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-flame-600" />
                      <div>
                        <div className="font-semibold text-ink-900">{dep.sourceStation?.name} → {dep.destinationStation?.name}</div>
                        <div className="text-xs text-ink-400">{dep.sourceStation?.location} → {dep.destinationStation?.location}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-ink-500">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(dep.departureTime).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-ink-500">
                      <Bus className="h-4 w-4" />
                      <span>{dep.vehicle?.plateNumber} ({dep.vehicle?.model})</span>
                    </div>
                  </div>
                )}

                <hr className="my-4 border-ink-100" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-500">Price per seat</span>
                    <span className="font-semibold text-ink-900">{rwf(dep?.price || PRICE_PER_SEAT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Seats</span>
                    <span className="font-semibold text-ink-900">
                      {selectedSeats.length > 0
                        ? selectedSeats.map(seatNumberToLabel).join(', ')
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Service fee</span>
                    <span className="font-semibold text-ink-900">{rwf(selectedSeats.length > 0 ? SERVICE_FEE : 0)}</span>
                  </div>
                </div>

                <hr className="my-4 border-ink-100" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-500">Total</span>
                  <span className="text-2xl font-extrabold text-ink-900">{rwf(total)}</span>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-ink-500 mb-2 block">Pay with</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('wallet')}
                      className={`btn text-xs py-2.5 ${paymentMode === 'wallet' ? 'bg-ink-900 text-white' : 'btn-outline'}`}
                    >
                      💰 Tapa Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('card')}
                      className={`btn text-xs py-2.5 ${paymentMode === 'card' ? 'bg-ink-900 text-white' : 'btn-outline'}`}
                    >
                      💳 Card Payment
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleBuy}
                  disabled={selectedSeats.length === 0 || submitting}
                  className="btn-primary mt-4 w-full py-3.5 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : paymentMode === 'card' ? 'Pay with Card' : `Pay ${rwf(total)}`}
                </button>

                {selectedSeats.length > 0 && !submitting && !success && (
                  <p className="mt-2 text-center text-xs text-ink-400">
                    {paymentMode === 'wallet'
                      ? 'You will be charged from your Tapa wallet.'
                      : 'Test mode: no real payment will be processed. Enter any card details.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Inline TicketIcon since we removed the lucide import
function TicketIcon(props: { className?: string }) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  )
}
