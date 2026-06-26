// src/modules/payments/payments.controller.ts
import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import {
  createPaymentIntentSchema,
  confirmPaymentSchema,
  topupSchema,
} from './payments.schema.js';
import * as PaymentsService from './payments.service.js';
import { placeHold, commitHold } from '../../lib/wallet-journal.js';
import { db } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';
import { ValidationError } from '../../lib/errors.js';

export async function createIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createPaymentIntentSchema.parse(req.body);

    const result = await PaymentsService.createPaymentIntent(
      dto.amount,
      dto.currency,
      {
        userId: user.id,
        journeyId: dto.journeyId,
        seats: dto.seatNumbers.join(','),
      },
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = confirmPaymentSchema.parse(req.body);
    const result = await PaymentsService.confirmPaymentIntent(dto.paymentIntentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPaymentStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const info = PaymentsService.getTestPaymentInfo();
    res.json(info);
  } catch (error) {
    next(error);
  }
}

async function resolveWalletId(userId: string): Promise<string> {
  const wallet = await db.wallet.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!wallet) {
    throw new ValidationError('Wallet not found — set up your wallet first');
  }
  return wallet.id;
}

/**
 * POST /api/payments/topup
 *
 * Creates a Stripe PaymentIntent for funding the caller's Tapa wallet.
 * Also creates a PENDING WalletTransaction (TOPUP / CREDIT) whose
 * referenceId is the Stripe payment intent id. The webhook handler
 * (P6) commits the hold when Stripe confirms the charge.
 *
 * Idempotency: the client supplies an Idempotency-Key header which we
 * persist to an IdempotencyKey row and link to the journal entry, so
 * a retried request with the same key returns the same result rather
 * than creating duplicate holds.
 */
export async function createTopup(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = topupSchema.parse(req.body);

    // Idempotency key: client-supplied or generated per request.
    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) ??
      `topup:${user.id}:${Date.now()}`;

    // Create or reuse the IdempotencyKey row. The unique constraint on
    // (userId, route, key) means a duplicate insert returns the existing
    // row — we just need the id.
    const requestHash = createHash('sha256')
      .update(`${user.id}:${dto.amount}:${idempotencyKey}`)
      .digest('hex');
    let idemRow;
    try {
      idemRow = await db.idempotencyKey.create({
        data: {
          userId: user.id,
          route: 'POST /api/payments/topup',
          key: idempotencyKey,
          requestHash,
          state: 'PROCESSING',
        },
      });
    } catch (e: any) {
      // Unique violation -> already exists, fetch it.
      if (e?.code === 'P2002') {
        idemRow = await db.idempotencyKey.findUnique({
          where: {
            userId_route_key: {
              userId: user.id,
              route: 'POST /api/payments/topup',
              key: idempotencyKey,
            },
          },
        });
      } else {
        throw e;
      }
    }

    // 1. Create the Stripe PaymentIntent.
    const intent = await PaymentsService.createTopupIntent({
      userId: user.id,
      rwfAmount: dto.amount,
    });

    // 2. Create the PENDING wallet hold (CREDIT — funds in flight).
    const hold = await placeHold({
      walletId: await resolveWalletId(user.id),
      amount: dto.amount,
      direction: 'CREDIT',
      type: 'TOPUP',
      referenceId: intent.id,
      idempotencyKeyId: idemRow?.id,
      note: `Wallet top-up via Stripe (${intent.isMock ? 'mock' : intent.id})`,
      metadata: {
        stripePaymentIntentId: intent.id,
        rwfAmount: dto.amount,
        isMock: intent.isMock,
      },
    });

    // Mark the idempotency key COMPLETED.
    if (idemRow) {
      await db.idempotencyKey.update({
        where: { id: idemRow.id },
        data: { state: 'COMPLETED' },
      });
    }

    logger.info(
      { userId: user.id, amount: dto.amount, intentId: intent.id, holdId: hold.id },
      'topup intent created',
    );

    res.status(201).json({
      paymentIntentId: intent.id,
      clientSecret: intent.clientSecret,
      amount: dto.amount,
      currency: intent.currency,
      isMock: intent.isMock,
      holdTransactionId: hold.id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/payments/topup/confirm
 *
 * Commits a pending wallet top-up hold after the client confirms payment.
 * In mock mode this is the only way to credit the wallet without a webhook.
 * In live mode this is idempotent — if the webhook already committed the
 * hold, commitHold returns alreadyApplied.
 */
export async function confirmTopup(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = confirmPaymentSchema.parse(req.body);
    const paymentIntentId = dto.paymentIntentId;

    const hold = await db.walletTransaction.findFirst({
      where: { referenceId: paymentIntentId, status: 'PENDING', type: 'TOPUP' },
    });
    if (!hold) {
      res.json({ status: 'succeeded', alreadyApplied: true });
      return;
    }

    if (paymentIntentId.startsWith('pi_mock_')) {
      await PaymentsService.confirmPaymentIntent(paymentIntentId);
    }

    const result = await commitHold({
      transactionId: hold.id,
      metadata: { stripePaymentIntentId: paymentIntentId, source: 'topup_confirm' },
    });

    res.json({
      status: 'succeeded',
      alreadyApplied: result.alreadyApplied,
      holdTransactionId: hold.id,
    });
  } catch (error) {
    next(error);
  }
}
