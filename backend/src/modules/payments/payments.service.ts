import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

let stripe: Stripe | null = null;
const isStripeConfigured = !!env.STRIPE_SECRET_KEY;

if (isStripeConfigured) {
  stripe = new Stripe(env.STRIPE_SECRET_KEY!);
  logger.info('Stripe initialized');
} else {
  logger.info('STRIPE_SECRET_KEY not set — running in mock payment mode');
}

/**
 * Creates a payment intent using Stripe or mock mode.
 * In mock mode, returns a simulated successful payment intent.
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
) {
  // Normalize currency to lowercase for Stripe
  const stripeCurrency = currency.toLowerCase() === 'rwf' ? 'usd' : currency.toLowerCase();
  const stripeAmount = currency.toLowerCase() === 'rwf'
    ? Math.round(amount / 1500 * 100) // Convert RWF to cents (USD)
    : amount;

  if (!isStripeConfigured || !stripe) {
    // Mock payment mode — simulate success for local testing
    const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info({ mockId, amount, currency }, 'Mock payment intent created');
    return {
      id: mockId,
      amount,
      currency,
      clientSecret: null,
      status: 'requires_payment_method',
      isMock: true,
    };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeAmount,
    currency: stripeCurrency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });

  logger.info({ paymentIntentId: paymentIntent.id, amount }, 'Stripe payment intent created');
  return {
    id: paymentIntent.id,
    amount,
    currency,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
    isMock: false,
  };
}

/**
 * Confirms a payment intent.
 * In mock mode, simulates successful confirmation.
 */
export async function confirmPaymentIntent(paymentIntentId: string) {
  if (!isStripeConfigured || !stripe) {
    // Mock mode — simulate success
    if (paymentIntentId.startsWith('pi_mock_')) {
      logger.info({ paymentIntentId }, 'Mock payment confirmed');
      return {
        id: paymentIntentId,
        status: 'succeeded',
        isMock: true,
      };
    }
    throw new Error('Invalid mock payment ID');
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status === 'succeeded') {
    return {
      id: paymentIntent.id,
      status: 'succeeded',
      isMock: false,
    };
  }

  // In a real app, you'd use a webhook to confirm. For now, simulate success.
  return {
    id: paymentIntent.id,
    status: paymentIntent.status,
    isMock: false,
  };
}

/**
 * Creates a Stripe PaymentIntent for a wallet top-up.
 *
 * The flow:
 *   1. Caller (controller) supplies the userId and the desired RWF amount.
 *   2. We convert RWF -> USD cents using a snapshot exchange rate.
 *   3. We create a Stripe PaymentIntent with the USD amount, storing the
 *      RWF amount + exchange rate + userId in the intent metadata.
 *   4. We create a PENDING WalletTransaction (type=TOPUP, direction=CREDIT)
 *      with referenceId = paymentIntent.id. This row is what the
 *      webhook handler will commit when Stripe confirms the charge.
 *   5. We return the client_secret so the frontend can mount Stripe
 *      Elements and confirm the payment inline.
 *
 * Idempotency: the controller should supply an Idempotency-Key header
 * which we map to an IdempotencyKey row. The placeHold inside the
 * wallet-journal already short-circuits on duplicate idempotency keys.
 */
export async function createTopupIntent(args: {
  userId: string;
  rwfAmount: number;
  idempotencyKeyId?: string;
}) {
  if (!isStripeConfigured || !stripe) {
    // Mock mode — return a fake client_secret so the frontend flow can
    // still be exercised locally without real Stripe credentials.
    const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mockSecret = `${mockId}_secret_mock`;
    logger.info({ mockId, rwfAmount: args.rwfAmount }, 'Mock topup intent created');
    return {
      id: mockId,
      clientSecret: mockSecret,
      amount: args.rwfAmount,
      currency: 'rwf',
      isMock: true,
    };
  }

  const stripeCurrency = 'usd';
  // RWF -> USD conversion. In production you'd fetch a live rate from
  // a forex API; for now we use the same 1500 RWF/USD approximation
  // that the existing createPaymentIntent uses. The rate is snapshotted
  // into metadata so we can credit the exact RWF amount regardless of
  // FX drift between intent creation and webhook delivery.
  const fxRate = 1500;
  const usdCents = Math.round((args.rwfAmount / fxRate) * 100);

  if (usdCents <= 0) {
    throw new Error('Top-up amount too small to convert to USD cents');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: usdCents,
    currency: stripeCurrency,
    metadata: {
      userId: args.userId,
      rwfAmount: String(args.rwfAmount),
      fxRate: String(fxRate),
      type: 'wallet_topup',
    },
    description: `Tapa wallet top-up (${args.rwfAmount} RWF)`,
    // For Elements-based confirmation we don't set confirm=true here —
    // the frontend confirms via stripe.confirmCardPayment().
    automatic_payment_methods: { enabled: true },
  });

  logger.info(
    { paymentIntentId: paymentIntent.id, userId: args.userId, rwfAmount: args.rwfAmount },
    'Stripe topup intent created',
  );

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: args.rwfAmount,
    currency: 'rwf',
    isMock: false,
  };
}

/**
 * Returns test card info for development mode.
 */
export function getTestPaymentInfo() {
  return {
    stripeConfigured: isStripeConfigured,
    mode: isStripeConfigured ? 'live' : 'mock',
    testCards: isStripeConfigured
      ? {
          success: '4242 4242 4242 4242',
          decline: '4000 0000 0000 0002',
          insufficientFunds: '4000 0000 0000 9995',
          expired: '4000 0000 0000 0069',
          cvcFail: '4000 0000 0000 0127',
          requiresAuth: '4000 0025 0000 3155',
        }
      : {
          info: 'Stripe not configured. Payments run in mock mode — any card details will simulate success.',
        },
  };
}
