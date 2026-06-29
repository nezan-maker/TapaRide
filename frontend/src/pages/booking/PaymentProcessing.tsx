import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { rwf } from '../../lib/utils'
import Fa from '../../components/Fa'
import BusSpinner from '../../components/BusSpinner'

export default function PaymentProcessing() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/booking/confirmation'), 4000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="bg-mist py-12">
      <div className="container-page">
        <div className="mx-auto max-w-md card p-8 text-center">
          <div className="mx-auto max-w-[120px]">
            <BusSpinner />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-ink-900">Processing your payment…</h1>
          <p className="mt-1 text-sm text-ink-500">We are confirming your transaction with the payment provider.</p>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-700">
            <Fa name="alerttriangle" className="h-4 w-4" /> Do not refresh or close the app
          </div>

          <div className="mt-6 space-y-2 border-t border-ink-100 pt-5 text-sm">
            <Row label="Merchant" value="TapaRide Ltd" />
            <Row label="Amount" value={rwf(2500)} />
          </div>

          <Link to="/booking/failed" className="mt-6 inline-block text-xs font-semibold text-ink-400 hover:text-flame-600">
            Simulate payment failure
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  )
}
