import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api, ApiError } from '../lib/api';
import { rwf } from '../lib/utils';
import Fa from './Fa';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface TopupCheckoutProps {
  amount: number;
  clientSecret: string;
  paymentIntentId: string;
  isMock: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

function TopupCheckout({
  amount,
  paymentIntentId,
  isMock,
  onSuccess,
  onCancel,
}: TopupCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalizeTopup = async () => {
    await api.post('/api/payments/topup/confirm', { paymentIntentId });
    onSuccess();
  };

  const handleMockConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await finalizeTopup();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Top-up failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStripeConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (result.error) {
        throw new ApiError(result.error.message ?? 'Payment failed', 400);
      }
      await finalizeTopup();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  if (isMock || !stripePromise) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Fa name="alert-circle" className="mr-1.5 inline h-4 w-4" />
          Stripe is in mock mode. Confirm to credit your wallet instantly.
        </div>
        <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-500">Amount</span>
            <span className="font-bold text-ink-900">{rwf(amount)}</span>
          </div>
        </div>
        {error && (
          <div className="rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-outline">
            Cancel
          </button>
          <button type="button" onClick={handleMockConfirm} disabled={busy} className="btn-primary">
            {busy ? 'Processing…' : 'Confirm top-up'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleStripeConfirm} className="space-y-4">
      <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-500">Amount</span>
          <span className="font-bold text-ink-900">{rwf(amount)}</span>
        </div>
      </div>
      <PaymentElement />
      {error && (
        <div className="rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">{error}</div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-outline">
          Cancel
        </button>
        <button type="submit" disabled={busy || !stripe} className="btn-primary">
          {busy ? 'Processing…' : 'Pay with card'}
        </button>
      </div>
    </form>
  );
}

interface StripeTopupFormProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StripeTopupForm({ amount, onSuccess, onCancel }: StripeTopupFormProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{
    clientSecret: string;
    paymentIntentId: string;
    isMock: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post('/api/payments/topup', { amount });
        if (cancelled) return;
        if (!result || !result.clientSecret) {
          throw new ApiError('Payment provider did not return a client secret', 500);
        }
        setSession({
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
          isMock: !!result.isMock,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not start top-up');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-ink-500">
        <Fa name="loader2" className="mx-auto mb-2 h-6 w-6 animate-spin" />
        Preparing secure checkout…
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          {error ?? 'Unable to start checkout'}
        </div>
        <button type="button" onClick={onCancel} className="btn-outline">
          Close
        </button>
      </div>
    );
  }

  if (session.isMock || !stripePromise) {
    return (
      <TopupCheckout
        amount={amount}
        clientSecret={session.clientSecret}
        paymentIntentId={session.paymentIntentId}
        isMock={session.isMock}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: session.clientSecret }}>
      <TopupCheckout
        amount={amount}
        clientSecret={session.clientSecret}
        paymentIntentId={session.paymentIntentId}
        isMock={false}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
