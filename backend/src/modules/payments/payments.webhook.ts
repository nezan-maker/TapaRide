// src/modules/payments/payments.webhook.ts
//
// Stripe webhook handler. Mounted at /api/payments/webhook with
// express.raw() so the raw body is available for signature verification.
//
// Security:
//   - Every request is verified with stripe.webhooks.constructEvent.
//     If STRIPE_WEBHOOK_SECRET is unset we reject everything (fail closed).
//   - Idempotent on Stripe event id: a UNIQUE constraint on
//     WalletTransaction.stripeEventId + an explicit existence check
//     before mutation means replayed events are no-ops.
//   - The handler never trusts the event payload alone to identify the
//     user or the transaction — it looks up our own WalletTransaction
//     row by the payment intent id stored in its referenceId.
//
// Events handled:
//   - payment_intent.succeeded  → commit the matching wallet hold
//   - payment_intent.payment_failed → release the matching wallet hold
//   - everything else           → 200 (acknowledged, no action)

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { commitHold, releaseHold } from '../../lib/wallet-journal.js';
import { NotFoundError } from '../../lib/errors.js';

let stripe: Stripe | null = null;
if (env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(env.STRIPE_SECRET_KEY);
}

const router = Router();

/**
 * Find the PENDING wallet transaction whose referenceId matches the
 * Stripe payment intent id. Returns null if none is found (which means
 * either the event is for a different system, or the hold was already
 * committed/released by a prior delivery of the same event).
 */
async function findPendingHold(paymentIntentId: string) {
  // Lazy import to avoid a circular dependency at module load.
  const { db } = await import('../../lib/db.js');
  return db.walletTransaction.findFirst({
    where: { referenceId: paymentIntentId, status: 'PENDING' },
    include: { wallet: { select: { userId: true } } },
  });
}

router.post('/', async (req: Request, res: Response) => {
  // ─── Signature verification ─────────────────────────────────────────────
  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Stripe webhook called but STRIPE_WEBHOOK_SECRET is not set');
    res.status(401).json({ error: 'Webhook secret not configured' });
    return;
  }
  if (!stripe) {
    logger.warn('Stripe webhook called but STRIPE_SECRET_KEY is not set');
    res.status(401).json({ error: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer because of express.raw().
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  // ─── Idempotency guard at the Stripe level ─────────────────────────────
  // If we already processed this exact event id, acknowledge and return.
  const { db } = await import('../../lib/db.js');
  const seen = await db.walletTransaction.findUnique({
    where: { stripeEventId: event.id },
  });
  if (seen) {
    logger.info({ eventId: event.id }, 'Stripe event already processed');
    res.json({ received: true, idempotent: true });
    return;
  }

  // ─── Dispatch by event type ────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const hold = await findPendingHold(pi.id);
        if (!hold) {
          // Not a wallet hold — could be a direct charge from another flow.
          // Acknowledge so Stripe doesn't retry.
          logger.info(
            { paymentIntentId: pi.id },
            'payment_intent.succeeded with no matching PENDING hold',
          );
          res.json({ received: true, action: 'none' });
          return;
        }

        const result = await commitHold({
          transactionId: hold.id,
          stripeEventId: event.id,
          metadata: {
            stripePaymentIntentId: pi.id,
            amount_received: pi.amount_received,
            currency: pi.currency,
          },
        });

        logger.info(
          { transactionId: hold.id, alreadyApplied: result.alreadyApplied },
          'wallet hold committed via Stripe webhook',
        );

        // If this hold is for a parcel send, the parcel service is
        // responsible for minting the claim key + SMS — that logic lives
        // in the parcel service and is invoked by the controller, not
        // here. We only commit the wallet hold here.
        res.json({ received: true, action: 'committed' });
        return;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const hold = await findPendingHold(pi.id);
        if (!hold) {
          logger.info(
            { paymentIntentId: pi.id },
            'payment_intent.payment_failed with no matching PENDING hold',
          );
          res.json({ received: true, action: 'none' });
          return;
        }

        const failureMessage =
          pi.last_payment_error?.message ?? 'Unknown failure';

        const result = await releaseHold({
          transactionId: hold.id,
          reason: `Stripe payment failed: ${failureMessage}`,
        });

        logger.info(
          { transactionId: hold.id, alreadyApplied: result.alreadyApplied },
          'wallet hold released via Stripe webhook (payment failed)',
        );

        res.json({ received: true, action: 'released' });
        return;
      }

      default: {
        // Acknowledge so Stripe doesn't consider this a failure and retry.
        logger.debug({ eventType: event.type }, 'Unhandled Stripe event type');
        res.json({ received: true, action: 'ignored' });
        return;
      }
    }
  } catch (err) {
    // Surface operational errors to Stripe so it retries. Validation /
    // conflict errors (e.g. already committed) are treated as success
    // from Stripe's perspective — we don't want infinite retries for
    // deterministic failures.
    if (err instanceof NotFoundError) {
      logger.warn({ eventId: event.id, err: err.message }, 'webhook target not found');
      res.json({ received: true, action: 'not_found' });
      return;
    }
    logger.error({ eventId: event.id, err }, 'Stripe webhook handler error');
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

export default router;
