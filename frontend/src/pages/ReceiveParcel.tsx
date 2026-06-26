import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { rwf } from '../lib/utils';
import Fa from '../components/Fa';

interface ClaimPreview {
  id: string;
  receiverName: string;
  status: string;
  fee: number | null;
  weight: number | null;
  from: string;
  to: string;
  expiresAt?: string;
  trackingCode: string;
}

export default function ReceiveParcel() {
  const [searchParams] = useSearchParams();
  const [claimKey, setClaimKey] = useState(searchParams.get('key') || '');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [step, setStep] = useState<'lookup' | 'confirm' | 'done'>('lookup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<ClaimPreview | null>(null);

  useEffect(() => {
    const key = searchParams.get('key');
    if (key) setClaimKey(key);
  }, [searchParams]);

  const lookupParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimKey.trim()) {
      setError('Enter the claim code from your SMS.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/api/parcels/claim/start', {
        claimKey: claimKey.trim().toUpperCase(),
      });
      setPreview(data);
      setStep('confirm');
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError ? err.message : 'Could not find parcel');
    } finally {
      setLoading(false);
    }
  };

  const confirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    if (!receiverPhone.trim()) {
      setError('Enter the phone number the parcel was sent to.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/api/parcels/claim', {
        claimKey: claimKey.trim().toUpperCase(),
        receiverPhone: receiverPhone.trim(),
      });
      setClaimed(data);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm receipt');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done' && claimed) {
    return (
      <div className="bg-mist py-16">
        <div className="container-page mx-auto max-w-lg text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Fa name="check-circle2" className="h-8 w-8" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold text-ink-900">Parcel received!</h1>
          <p className="mt-2 text-ink-500">
            Thanks for confirming. The sender has been notified.
          </p>
          <div className="card mt-8 p-6 text-left">
            <div className="text-sm text-ink-500">Tracking code</div>
            <div className="mt-1 text-xl font-bold text-ink-900">{claimed.trackingCode}</div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-ink-500">
                {(claimed as ClaimPreview).from ??
                  (claimed as { journey?: { sourceStation?: { name: string } } }).journey
                    ?.sourceStation?.name}
              </span>
              <Fa name="arrow-right" className="h-4 w-4 text-flame-600" />
              <span className="text-ink-500">
                {(claimed as ClaimPreview).to ??
                  (claimed as { journey?: { destinationStation?: { name: string } } }).journey
                    ?.destinationStation?.name}
              </span>
            </div>
          </div>
          <Link to="/" className="btn-primary mt-8 inline-flex">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mist py-12">
      <div className="container-page mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-ink-900">Receive a parcel</h1>
          <p className="mt-2 text-ink-500">
            Enter the claim code from your SMS. No Tapa account required.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'lookup' && (
          <form onSubmit={lookupParcel} className="card space-y-5 p-6">
            <div>
              <label className="label">Claim code</label>
              <input
                className="input text-center text-lg font-bold tracking-widest uppercase"
                placeholder="ABC-DEFG-HIJ"
                value={claimKey}
                onChange={(e) => setClaimKey(e.target.value.toUpperCase())}
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
              {loading ? 'Looking up…' : 'Find parcel'}
            </button>
          </form>
        )}

        {step === 'confirm' && preview && (
          <div className="space-y-5">
            <div className="card p-6">
              <div className="text-xs uppercase tracking-wide text-ink-400">Parcel for</div>
              <h2 className="mt-1 text-2xl font-extrabold text-ink-900">{preview.receiverName}</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span>{preview.from}</span>
                <Fa name="arrow-right" className="h-4 w-4 text-flame-600" />
                <span>{preview.to}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 text-sm">
                <span className="text-ink-500">
                  {preview.weight ? `${preview.weight} kg` : 'Parcel'}
                </span>
                {preview.fee != null && (
                  <span className="font-semibold text-ink-900">{rwf(preview.fee)}</span>
                )}
              </div>
            </div>

            <form onSubmit={confirmReceipt} className="card space-y-5 p-6">
              <div>
                <label className="label">Your phone number</label>
                <input
                  className="input"
                  placeholder="+250 7XX XXX XXX"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  disabled={loading}
                />
                <p className="mt-2 text-xs text-ink-400">
                  Must match the number the sender registered for this parcel.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('lookup');
                    setPreview(null);
                    setError(null);
                  }}
                  className="btn-outline flex-1"
                  disabled={loading}
                >
                  Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-3.5">
                  {loading ? 'Confirming…' : 'I confirm receipt'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
