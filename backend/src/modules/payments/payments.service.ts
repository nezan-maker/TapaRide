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
