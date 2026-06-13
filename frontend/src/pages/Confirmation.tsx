import { Link, useSearchParams } from 'react-router-dom'
import Stepper from '../components/Stepper'
import { rwf } from '../lib/utils'
import Fa from '../components/Fa';

export default function Confirmation() {
  const [searchParams] = useSearchParams()
  const seatStr = searchParams.get('seats') || ''
  const total = parseInt(searchParams.get('total') || '0', 10)
  const from = searchParams.get('from') || 'Kigali'
  const to = searchParams.get('to') || 'Huye'
  const date = searchParams.get('date') || new Date().toLocaleDateString()

  const seats = seatStr.split(',').filter(Boolean)

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
            <Fa name="check-circle2" className="h-8 w-8" />
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
                <Fa name="ticket" className="h-5 w-5" />
                <span className="font-bold">E-Ticket</span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Fa name="map-pin" className="h-4 w-4 text-flame-600" />
                <span className="font-semibold text-ink-900">{from}</span>
                <Fa name="arrow-right" className="h-3 w-3 text-ink-300" />
                <span className="font-semibold text-ink-900">{to}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <Fa name="calendar" className="h-4 w-4" />
                <span>{date}</span>
              </div>
              {seats.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Fa name="user" className="h-4 w-4 text-ink-400" />
                  <span className="text-ink-500">Seats:</span>
                  <span className="font-bold text-ink-900">{seats.join(', ')}</span>
                </div>
              )}
              {total > 0 && (
                <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <Fa name="tag" className="h-4 w-4 text-flame-600" /> Total: {rwf(total)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <Link to="/dashboard/trips" className="btn-primary flex-1">View My Trips</Link>
            <button className="btn-outline flex-1">
              <Fa name="download" className="h-4 w-4" /> Download Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
