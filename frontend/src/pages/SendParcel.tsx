import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { rwf } from '../lib/utils';
import { api, ApiError } from '../lib/api';
import Fa from '../components/Fa';
import Select from '../components/Select';

interface Quote {
  fee: number;
  basePrice: number;
  band: { label: string };
  baseRate: number;
  journeyId: string;
}

interface WalletStatus {
  status: string;
  unlocked: boolean;
}

export default function SendParcel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';

  const [stations, setStations] = useState<string[]>([]);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [weight, setWeight] = useState(1);
  const [note, setNote] = useState('');
  const [walletPassword, setWalletPassword] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    fetchStations();
    fetchWallet();
  }, []);

  const fetchStations = async () => {
    try {
      const data = await api.get('/api/stations');
      const list = data.stations || data.items || data;
      const names = Array.isArray(list)
        ? list.map((s: string | { name?: string }) => (typeof s === 'string' ? s : s.name || ''))
        : [];
      setStations(
        names.filter(Boolean).length > 0
          ? names
          : [
              'Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)',
              'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi',
            ],
      );
    } catch {
      setStations([
        'Kigali (Nyabugogo)', 'Huye', 'Musanze', 'Rubavu (Gisenyi)',
        'Rusizi', 'Nyagatare', 'Muhanga', 'Karongi',
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const status = await api.get('/api/wallet');
      setWallet(status);
      if (status.unlocked) {
        const balanceRes = await api.post('/api/wallet/balance', {});
        if (balanceRes?.balance != null) setBalance(balanceRes.balance);
      }
    } catch {
      setWallet({ status: 'UNINITIALIZED', unlocked: false });
    }
  };

  const canQuote = Boolean(from && to && weight > 0);

  useEffect(() => {
    if (!canQuote) { setQuote(null); return; }
    const timer = setTimeout(async () => {
      setQuoting(true);
      setError(null);
      try {
        const params = new URLSearchParams({ fromStation: from, toStation: to, weight: String(weight) });
        const data = await api.get(`/api/parcels/quote?${params}`);
        setQuote(data);
      } catch (err) {
        setQuote(null);
        setError(err instanceof ApiError ? err.message : 'Could not fetch quote');
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [from, to, weight, canQuote]);

  const insufficientBalance = useMemo(() => {
    if (balance == null || quote == null) return false;
    return balance < quote.fee;
  }, [balance, quote]);

  const availableFrom = stations.filter((s) => s !== to);
  const availableTo = stations.filter((s) => s !== from);

  // ── Section completion logic ─────────────────────────────────────────
  const section1Complete = Boolean(from && to);
  const section2Complete = Boolean(receiverName && receiverPhone && weight > 0);
  const section3Ready = Boolean(quote && (wallet?.unlocked || walletPassword) && !insufficientBalance);
  const canSubmit = section1Complete && section2Complete && section3Ready && !loading && !quoting;

  const completedSections = [section1Complete, section2Complete, section3Ready].filter(Boolean).length;

  const goToSection2 = () => { if (section1Complete) setStep(2); };
  const goToSection3 = () => { if (section1Complete && section2Complete) setStep(3); };
  const goBack = () => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const parcel = await api.post('/api/parcels', {
        receiverName, receiverPhone,
        fromStation: from, toStation: to,
        weight, notes: note || undefined,
        walletPassword: walletPassword || undefined,
      });
      navigate('/parcel/confirmation', {
        state: {
          trackingCode: parcel.trackingCode, claimKey: parcel.claimKey,
          fee: parcel.fee, weight: parcel.weight ?? weight,
          from: parcel.journey?.sourceStation?.name ?? from,
          to: parcel.journey?.destinationStation?.name ?? to,
          receiverName,
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send parcel');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-mist py-8 sm:py-12">
      <div className="container-page mx-auto max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">Send a Parcel</h1>
          <p className="mt-1 text-ink-500">
            Pay from your Tapa wallet. Your receiver gets an SMS claim code when payment confirms.
          </p>
        </div>

        {/* ── Dynamic progress bar ──────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-500">
            <span>Step {step} of 3</span>
            <span className="text-flame-600">{completedSections} / 3 complete</span>
          </div>
          <div className="mt-3 flex gap-2">
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${section1Complete ? 'bg-flame-500' : 'bg-ink-100'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${section2Complete ? 'bg-flame-500' : 'bg-ink-100'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${section3Ready ? 'bg-flame-500' : 'bg-ink-100'}`} />
          </div>
          <div className="mt-3 flex justify-between text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`transition ${step === 1 ? 'text-flame-600' : 'text-ink-400 hover:text-ink-700'} ${section1Complete ? 'cursor-pointer' : ''}`}
            >
              {section1Complete ? '✓ ' : '1. '}Route
            </button>
            <button
              type="button"
              onClick={goToSection2}
              disabled={!section1Complete}
              className={`transition ${step === 2 ? 'text-flame-600' : 'text-ink-400'} ${section1Complete ? 'cursor-pointer hover:text-ink-700' : 'cursor-not-allowed opacity-60'}`}
            >
              {section2Complete ? '✓ ' : '2. '}Details
            </button>
            <button
              type="button"
              onClick={goToSection3}
              disabled={!section1Complete || !section2Complete}
              className={`transition ${step === 3 ? 'text-flame-600' : 'text-ink-400'} ${section1Complete && section2Complete ? 'cursor-pointer hover:text-ink-700' : 'cursor-not-allowed opacity-60'}`}
            >
              {section3Ready ? '✓ ' : '3. '}Payment
            </button>
          </div>
        </div>

        {/* ── Wallet banner ──────────────────────────────────────────────── */}
        {wallet?.status === 'UNINITIALIZED' && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Fa name="wallet" className="mr-1.5 inline h-4 w-4" />
            You need a wallet before sending parcels.{' '}
            <Link to="/dashboard/payments" className="font-semibold underline">Set up wallet</Link>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
            <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-5 sm:p-6">
          {/* ── Step 1: Route ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-up">
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${section1Complete ? 'bg-flame-500 text-white' : 'bg-ink-900 text-white'}`}>
                  {section1Complete ? <Fa name="check" className="h-3.5 w-3.5" /> : '1'}
                </span>
                <h2 className="text-lg font-semibold text-ink-900">Where is this going?</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="From"
                  options={[{ value: '', label: 'Select city' }, ...availableFrom.map((c) => ({ value: c, label: c }))]}
                  value={from}
                  onChange={(v) => setFrom(v)}
                  disabled={loading || submitting}
                />
                <Select
                  label="To"
                  options={[{ value: '', label: 'Select city' }, ...availableTo.map((c) => ({ value: c, label: c }))]}
                  value={to}
                  onChange={(v) => setTo(v)}
                  disabled={loading || submitting}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={goToSection2}
                  disabled={!section1Complete}
                  className="btn-primary px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next — Details <Fa name="arrow-right" className="ml-1 h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Details ───────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-up">
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${section2Complete ? 'bg-flame-500 text-white' : 'bg-ink-900 text-white'}`}>
                  {section2Complete ? <Fa name="check" className="h-3.5 w-3.5" /> : '2'}
                </span>
                <h2 className="text-lg font-semibold text-ink-900">Receiver details</h2>
              </div>

              <div>
                <label className="label">Receiver name</label>
                <div className="relative">
                  <Fa name="user" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    className="input pl-9"
                    placeholder="e.g. Jean Paul"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="label">Receiver phone</label>
                <div className="relative">
                  <Fa name="phone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    className="input pl-9"
                    placeholder="+250 7XX XXX XXX"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="label">Weight (kg)</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setWeight(Math.max(0.5, weight - 0.5))} className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100" disabled={submitting}>
                    <Fa name="minus" className="h-4 w-4" />
                  </button>
                  <span className="w-16 text-center text-lg font-extrabold text-ink-900">{weight}</span>
                  <button type="button" onClick={() => setWeight(Math.min(50, weight + 0.5))} className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100" disabled={submitting}>
                    <Fa name="plus" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Note (optional)</label>
                <div className="relative">
                  <Fa name="stickynote" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" />
                  <textarea
                    className="input min-h-[80px] resize-none pl-9 pt-3"
                    placeholder="Fragile, handle with care..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={goBack} className="btn-outline px-5 py-3">
                  <Fa name="arrow-left" className="mr-1 h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={goToSection3}
                  disabled={!section2Complete}
                  className="btn-primary px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next — Payment <Fa name="arrow-right" className="ml-1 h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Payment ───────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-up">
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${section3Ready ? 'bg-flame-500 text-white' : 'bg-ink-900 text-white'}`}>
                  {section3Ready ? <Fa name="check" className="h-3.5 w-3.5" /> : '3'}
                </span>
                <h2 className="text-lg font-semibold text-ink-900">Confirm & pay</h2>
              </div>

              {/* Summary card */}
              <div className="rounded-xl border border-ink-100 bg-ink-50 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">Route</span>
                  <span className="font-semibold text-ink-900">{from} → {to}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">Receiver</span>
                  <span className="font-semibold text-ink-900">{receiverName} · {receiverPhone}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">Weight</span>
                  <span className="font-semibold text-ink-900">{weight} kg</span>
                </div>
                <div className="h-px bg-ink-100" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">Parcel fee</span>
                  <span className="text-lg font-extrabold text-ink-900">
                    {quoting ? 'Calculating…' : quote ? rwf(quote.fee) : '—'}
                  </span>
                </div>
                {quote && (
                  <p className="text-xs text-ink-400">
                    {Math.round(quote.baseRate * 100)}% of ticket ({rwf(quote.basePrice)}) × {quote.band.label}
                  </p>
                )}
                {balance != null && quote && (
                  <p className={`text-xs ${insufficientBalance ? 'text-flame-600' : 'text-emerald-600'}`}>
                    Wallet balance: {rwf(balance)}
                    {insufficientBalance && (
                      <> — <Link to="/dashboard/payments" className="font-semibold underline">Top up</Link></>
                    )}
                  </p>
                )}
              </div>

              {wallet && wallet.status !== 'UNINITIALIZED' && !wallet.unlocked && (
                <div>
                  <label className="label">Wallet password</label>
                  <div className="relative">
                    <Fa name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input
                      type="password"
                      className="input pl-9"
                      placeholder="Authorize payment from your wallet"
                      value={walletPassword}
                      onChange={(e) => setWalletPassword(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={goBack} className="btn-outline px-5 py-3">
                  <Fa name="arrow-left" className="mr-1 h-4 w-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="btn-primary px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing payment…' : `Pay ${quote ? rwf(quote.fee) : ''} & Send`}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
