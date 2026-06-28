import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper';
import { rwf } from '../lib/utils';
import Fa from '../components/Fa';

interface ParcelSuccessState {
  trackingCode: string;
  claimKey?: string;
  fee: number;
  weight: number;
  from: string;
  to: string;
  receiverName: string;
}

export default function ParcelConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ParcelSuccessState | null;
  const [copied, setCopied] = useState<'tracking' | 'claim' | null>(null);

  if (!state?.trackingCode) {
    return (
      <div className="bg-mist py-16 text-center">
        <p className="text-ink-500">No parcel details found.</p>
        <Link to="/send-parcel" className="btn-primary mt-4 inline-flex">
          Send a parcel
        </Link>
      </div>
    );
  }

  const copyText = async (text: string, kind: 'tracking' | 'claim') => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-mist pb-16">
      <div className="border-b border-ink-100 bg-white py-5">
        <div className="container-page">
          <Stepper steps={['Route', 'Details', 'Payment']} current={3} />
        </div>
      </div>

      <div className="container-page py-12">
        <div className="mx-auto max-w-lg text-center">
          <span className="mx-auto grid h-16 w-16 animate-fade-in place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Fa name="check-circle2" className="h-8 w-8" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold text-ink-900">Parcel confirmed!</h1>
          <p className="mt-2 text-ink-500">
            Payment received. We texted {state.receiverName} a claim code to pick up the parcel.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-lg space-y-4">
          {state.claimKey && (
            <div className="card border-emerald-100 bg-emerald-50/40 p-6 text-center">
              <div className="text-xs uppercase tracking-wide text-emerald-700">Receiver claim key</div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="text-2xl font-extrabold tracking-wider text-ink-900">
                  {state.claimKey}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(state.claimKey!, 'claim')}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white text-ink-600 hover:bg-ink-50"
                  aria-label="Copy claim key"
                >
                  <Fa name="copy" className="h-4 w-4" />
                </button>
              </div>
              {copied === 'claim' && (
                <p className="mt-2 text-xs text-emerald-600">Claim key copied</p>
              )}
            </div>
          )}

          <div className="card p-6 text-center">
            <div className="text-xs uppercase tracking-wide text-ink-400">Your tracking code</div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="text-2xl font-extrabold tracking-wider text-ink-900">
                {state.trackingCode}
              </span>
              <button
                type="button"
                onClick={() => copyText(state.trackingCode, 'tracking')}
                className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 text-ink-600 hover:bg-ink-100"
                aria-label="Copy tracking code"
              >
                <Fa name="copy" className="h-4 w-4" />
              </button>
            </div>
            {copied === 'tracking' && (
              <p className="mt-2 text-xs text-emerald-600">Tracking code copied</p>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-ink-900">
                <Fa name="package" className="h-5 w-5" /> {state.weight} kg
              </div>
              <span className="font-extrabold text-ink-900">{rwf(state.fee)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <Leg city={state.from} />
              <Fa name="arrow-right" className="h-5 w-5 text-flame-600" />
              <Leg city={state.to} right />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link to={`/track?code=${state.trackingCode}`} className="btn-primary flex-1">
                Track Parcel <Fa name="arrow-right" className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => navigate('/send-parcel')}
                className="btn-outline flex-1"
              >
                Send Another
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4">
            <Fa name="bell" className="mt-0.5 h-5 w-5 text-flame-600" />
            <p className="text-sm text-ink-500">
              The receiver can open{' '}
              <Link to="/receive" className="font-semibold text-flame-600">
                taparide.onrender.com/receive
              </Link>{' '}
              and enter the claim code to confirm pickup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Leg({ city, right }: { city: string; right?: boolean }) {
  return (
    <div className={right ? 'text-right' : ''}>
      <div className="flex items-center gap-1.5 font-semibold text-ink-900">
        {!right && <Fa name="map-pin" className="h-4 w-4 text-flame-600" />}
        {city}
        {right && <Fa name="map-pin" className="h-4 w-4 text-flame-600" />}
      </div>
    </div>
  );
}
