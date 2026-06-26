// src/lib/wallet-journal.ts
//
// Wallet journal — the only money-moving primitive surface for TapaRide.
//
// Invariants:
//   1. ONE row in `WalletTransaction` is created per logical money move.
//   2. The Wallet's availableBalance and heldBalance are mutated ONLY in
//      a transaction that creates or finalizes a WalletTransaction.
//   3. Permission to commit / release / reverse a row requires that the
//      row already exists and is in the correct state. State transitions:
//        PENDING   -> COMMITTED   (commitHold)
//        PENDING   -> RELEASED    (releaseHold)
//        COMMITTED -> REVERSED    (reverseTransaction)
//      Terminal states are terminal; rejecting any further mutation.
//   4. All calls run under `runSerializable`, with `pg_advisory_xact_lock`
//      keyed on the wallet. Two concurrent webhook deliveries for the
//      same `stripeEventId` cannot double-commit (UNIQUE constraint +
//      application-level existence check before mutation).
//   5. The held balance column is encrypted at rest with the same
//      AES-256-GCM primitives the existing balance uses — same PIN-derived
//      key, separate IV. Salt is reused from the wallet row (per-wallet).
//
// Encryption model (matches existing wallet.service.ts):
//   - The user's PIN is hashed with bcrypt (stored in walletPassword).
//   - On unlock, a 256-bit AES key is derived via PBKDF2(pin, salt, 310k).
//   - That derived key is what encryptWalletBalance / decryptWalletBalance
//     use as `passwordOrKey` — NOT the env-held DATABASE_ENCRYPTION_KEY.
//   - The env key is used for data-at-rest encryption of secrets; the
//     wallet balance is encrypted with the PIN-derived key so that even
//     a DB dump doesn't reveal balances without the user's PIN.
//   - Our reseal helper therefore needs the PIN (or the cached derived
//     key from Redis) — exactly like deposit() / withdraw() do.

import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { runSerializable } from './db.js';
import {
  encryptWalletBalance,
  decryptWalletBalance,
  deriveKeyPBKDF2,
  comparePassword,
} from './crypto-pool.js';
import { Prisma } from '@prisma/client';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  AuthenticationError,
} from './errors.js';
import { publishDomainEvent } from './domain-events.js';
import { logger } from './logger.js';
import { redis } from './redis.js';

type Direction = 'CREDIT' | 'DEBIT';
type TransactionType =
  | 'TOPUP'
  | 'TICKET_PURCHASE'
  | 'TICKET_REFUND'
  | 'PARCEL_SEND'
  | 'PARCEL_SEND_REFUND'
  | 'ADJUSTMENT'
  | 'WITHDRAWAL';

const PAWT = 'wallet';

/**
 * Resolve the AES-256 key used to encrypt/decrypt wallet balances.
 *
 * Strategy (matches existing wallet.service.ts deposit/withdraw):
 *   1. If `walletPassword` (the user's PIN) is supplied, verify it
 *      against the stored bcrypt hash and derive the key via PBKDF2.
 *   2. Else, look up the Redis-cached derived key from a prior unlock
 *      (TTL 15 min). If neither is available, the wallet is locked and
 *      we throw AuthenticationError.
 *
 * Returns the derived key as a Buffer (suitable for crypto-pool).
 */
async function resolveWalletKey(
  tx: Prisma.TransactionClient,
  walletId: string,
  walletPassword?: string,
): Promise<{ key: Buffer; wallet: Prisma.WalletGetPayload<{}> }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${PAWT}:${walletId}`}))`;
  const w = await tx.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundError('Wallet not found');
  if (w.status !== 'ACTIVE') {
    throw new ValidationError(`Wallet is not active (status=${w.status})`);
  }
  if (!w.walletPassword || !w.salt) {
    throw new ValidationError('Wallet has no PIN set');
  }

  let key: Buffer;
  if (walletPassword) {
    const valid = await comparePassword(walletPassword, w.walletPassword);
    if (!valid) throw new AuthenticationError('Incorrect wallet PIN');
    const keyBase64 = await deriveKeyPBKDF2(walletPassword, w.salt);
    key = Buffer.from(keyBase64, 'base64');
  } else {
    const cachedKey = await redis.get(`wallet:unlock-key:${w.userId}`);
    if (!cachedKey) {
      throw new AuthenticationError(
        'Wallet is locked. Unlock the wallet or supply the PIN.',
      );
    }
    key = Buffer.from(cachedKey, 'base64');
  }

  return { key, wallet: w };
}

/**
 * Read-only helper for the available balance, in whole RWF.
 * Requires the PIN or an active unlock session.
 */
export async function getAvailableBalanceRwf(
  walletId: string,
  walletPassword?: string,
): Promise<number> {
  const w = await db.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundError('Wallet not found');
  if (!w.encryptedBalance || !w.iv || !w.authTag || !w.salt) return 0;
  const salt = w.salt; // non-null after the guard above

  let key: Buffer;
  if (walletPassword) {
    if (!w.walletPassword) throw new ValidationError('Wallet has no PIN');
    const valid = await comparePassword(walletPassword, w.walletPassword);
    if (!valid) throw new AuthenticationError('Incorrect wallet PIN');
    key = Buffer.from(await deriveKeyPBKDF2(walletPassword, salt), 'base64');
  } else {
    const cached = await redis.get(`wallet:unlock-key:${w.userId}`);
    if (!cached) throw new AuthenticationError('Wallet is locked');
    key = Buffer.from(cached, 'base64');
  }

  return decryptWalletBalance(
    w.encryptedBalance,
    w.iv,
    w.authTag,
    salt,
    key,
  );
}

/**
 * Read-only helper for the held balance column. Requires PIN or unlock.
 * Held balance is server-internal; never shown to the end user.
 */
export async function getHeldBalanceRwf(
  walletId: string,
  walletPassword?: string,
): Promise<number> {
  const w = await db.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundError('Wallet not found');
  if (!w.encryptedHeldBalance || !w.heldBalanceIv || !w.heldBalanceAuthTag) {
    return 0;
  }
  const salt = w.salt ?? '';
  let key: Buffer;
  if (walletPassword) {
    if (!w.walletPassword) throw new ValidationError('Wallet has no PIN');
    const valid = await comparePassword(walletPassword, w.walletPassword);
    if (!valid) throw new AuthenticationError('Incorrect wallet PIN');
    key = Buffer.from(await deriveKeyPBKDF2(walletPassword, salt), 'base64');
  } else {
    const cached = await redis.get(`wallet:unlock-key:${w.userId}`);
    if (!cached) throw new AuthenticationError('Wallet is locked');
    key = Buffer.from(cached, 'base64');
  }

  return decryptWalletBalance(
    w.encryptedHeldBalance,
    w.heldBalanceIv,
    w.heldBalanceAuthTag,
    salt,
    key,
  );
}

/**
 * Decrypt the current value of an encrypted column, apply a delta
 * (positive or negative integer in RWF), re-encrypt with a fresh IV,
 * and persist. Must be called inside a transaction that already holds
 * the wallet lock.
 *
 * `field` selects which column pair to reseal:
 *   - 'encryptedBalance' -> available balance
 *   - 'encryptedHeldBalance' -> held balance
 */
async function resealColumn(
  tx: Prisma.TransactionClient,
  walletId: string,
  field: 'encryptedBalance' | 'encryptedHeldBalance',
  deltaRwf: number,
  key: Buffer,
): Promise<void> {
  const w = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });

  const cipher =
    field === 'encryptedBalance' ? w.encryptedBalance : w.encryptedHeldBalance;
  const iv = field === 'encryptedBalance' ? w.iv : w.heldBalanceIv;
  const tag = field === 'encryptedBalance' ? w.authTag : w.heldBalanceAuthTag;

  let current = 0;
  if (cipher && iv && tag) {
    current = await decryptWalletBalance(cipher, iv, tag, w.salt ?? '', key);
  }

  const next = current + deltaRwf;
  if (next < 0) {
    throw new ValidationError(
      `Insufficient balance: have ${current} RWF, attempted delta ${deltaRwf}`,
    );
  }

  // Re-encrypt with a fresh IV. The salt is per-wallet and reused.
  const sealed = await encryptWalletBalance(next, key);

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      [field]: sealed.encryptedBalance,
      [field === 'encryptedBalance' ? 'iv' : 'heldBalanceIv']: sealed.iv,
      [field === 'encryptedBalance' ? 'authTag' : 'heldBalanceAuthTag']:
        sealed.authTag,
      version: { increment: 1 },
    },
  });
}

// ─── Public mutation primitives ────────────────────────────────────────────

interface PlaceHoldInput {
  walletId: string;
  amount: number;          // whole RWF; must be > 0
  direction: Direction;    // CREDIT (topup pending) or DEBIT (parcel send etc.)
  type: TransactionType;
  referenceId?: string;    // parcel id, ticket id, etc. — for joins
  idempotencyKeyId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  /** User's wallet PIN. Optional — falls back to Redis unlock cache. */
  walletPassword?: string;
}

/**
 * Place a hold on a wallet for `amount` RWF. Behavior:
 *   - DEBIT: availableBalance -= amount, heldBalance += amount. Requires
 *     available balance >= amount or throws ValidationError.
 *   - CREDIT: heldBalance += amount (a refund-pending). Available is
 *     untouched. Used during reverse flows.
 *
 * Returns the new WalletTransaction row id (status=PENDING).
 */
export async function placeHold(input: PlaceHoldInput): Promise<{ id: string }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError('amount must be a positive integer (RWF)');
  }
  return runSerializable(async (tx) => {
    const { key, wallet } = await resolveWalletKey(
      tx,
      input.walletId,
      input.walletPassword,
    );

    // Idempotency short-circuit: if an Idempotency-Key already mapped
    // the same logical op, return its tx row.
    if (input.idempotencyKeyId) {
      const existing = await tx.walletTransaction.findFirst({
        where: { idempotencyKeyId: input.idempotencyKeyId },
      });
      if (existing) return { id: existing.id };
    }

    // Compute available balance to validate sufficiency.
    let available = 0;
    if (wallet.encryptedBalance && wallet.iv && wallet.authTag) {
      available = await decryptWalletBalance(
        wallet.encryptedBalance,
        wallet.iv,
        wallet.authTag,
        wallet.salt ?? '',
        key,
      );
    }
    if (input.direction === 'DEBIT' && input.amount > available) {
      throw new ValidationError(
        `Insufficient balance: have ${available} RWF, need ${input.amount} RWF`,
      );
    }

    // Mutate balance columns (DEBIT) or only held (CREDIT).
    if (input.direction === 'DEBIT') {
      await resealColumn(tx, wallet.id, 'encryptedBalance', -input.amount, key);
    }
    await resealColumn(tx, wallet.id, 'encryptedHeldBalance', +input.amount, key);

    const txRow = await tx.walletTransaction.create({
      data: {
        id: randomUUID(),
        walletId: wallet.id,
        type: input.type,
        status: 'PENDING',
        direction: input.direction,
        amount: input.amount,
        referenceId: input.referenceId ?? null,
        idempotencyKeyId: input.idempotencyKeyId ?? null,
        note: input.note ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    logger.info(
      { txId: txRow.id, type: txRow.type, amount: txRow.amount, dir: txRow.direction },
      'wallet: placeHold',
    );
    return { id: txRow.id };
  });
}

/**
 * Commit a held transaction. Operates only on rows that are still PENDING.
 * Idempotent on `stripeEventId`: if the event has already been processed
 * (another row already has this eventId, or this row already has it
 * committed in COMMITTED state), we return the existing outcome.
 */
export async function commitHold(input: {
  transactionId: string;
  stripeEventId?: string;
  metadata?: Record<string, unknown>;
  walletPassword?: string;
}): Promise<{ id: string; alreadyApplied: boolean }> {
  return runSerializable(async (tx) => {
    // Stripe-level idempotency: if a row already claims this eventId,
    // refuse to double-commit. This is the primary defense against
    // at-least-once webhook delivery.
    if (input.stripeEventId) {
      const prior = await tx.walletTransaction.findUnique({
        where: { stripeEventId: input.stripeEventId },
      });
      if (prior && prior.id !== input.transactionId) {
        throw new ConflictError(
          'Stripe event already applied to a different transaction',
        );
      }
    }

    const row = await tx.walletTransaction.findUnique({
      where: { id: input.transactionId },
    });
    if (!row) throw new NotFoundError('WalletTransaction not found');

    // Idempotent terminal states.
    if (row.status === 'COMMITTED') {
      if (input.stripeEventId && row.stripeEventId !== input.stripeEventId) {
        await tx.walletTransaction.update({
          where: { id: row.id },
          data: { stripeEventId: input.stripeEventId },
        });
      }
      return { id: row.id, alreadyApplied: true };
    }
    if (row.status !== 'PENDING') {
      throw new ConflictError(
        `Transaction ${row.id} is ${row.status}; cannot commit`,
      );
    }

    const { key, wallet } = await resolveWalletKey(
      tx,
      row.walletId,
      input.walletPassword,
    );

    // On commit: heldBalance -= amount (regardless of direction). The
    // available balance was already debited at place-hold time; on
    // commit we just stop holding the funds.
    await resealColumn(tx, wallet.id, 'encryptedHeldBalance', -row.amount, key);

    const updated = await tx.walletTransaction.update({
      where: { id: row.id },
      data: {
        status: 'COMMITTED',
        committedAt: new Date(),
        stripeEventId: input.stripeEventId ?? row.stripeEventId,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : (row.metadata as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
      },
    });

    await publishDomainEvent('wallet.transaction.committed', {
      transactionId: updated.id,
      walletId: updated.walletId,
      type: updated.type,
      referenceId: updated.referenceId,
      amount: updated.amount,
    });

    logger.info({ txId: updated.id, type: updated.type }, 'wallet: commitHold');
    return { id: updated.id, alreadyApplied: false };
  });
}

/**
 * Release a hold (e.g. Stripe payment failed). Returns funds to the
 * available balance for DEBIT holds. For CREDIT holds (refunds pending),
 * we only decrement heldBalance — no balance change needed because the
 * source refund hasn't arrived yet.
 */
export async function releaseHold(input: {
  transactionId: string;
  reason?: string;
  walletPassword?: string;
}): Promise<{ id: string; alreadyApplied: boolean }> {
  return runSerializable(async (tx) => {
    const row = await tx.walletTransaction.findUnique({
      where: { id: input.transactionId },
    });
    if (!row) throw new NotFoundError('WalletTransaction not found');

    if (row.status === 'RELEASED') {
      return { id: row.id, alreadyApplied: true };
    }
    if (row.status !== 'PENDING') {
      throw new ConflictError(
        `Transaction ${row.id} is ${row.status}; cannot release`,
      );
    }

    const { key, wallet } = await resolveWalletKey(
      tx,
      row.walletId,
      input.walletPassword,
    );

    // Reverse the held amount landing. For DEBIT holds, also recover the
    // available balance that was deducted at place-time.
    await resealColumn(tx, wallet.id, 'encryptedHeldBalance', -row.amount, key);
    if (row.direction === 'DEBIT') {
      await resealColumn(tx, wallet.id, 'encryptedBalance', +row.amount, key);
    }

    const updated = await tx.walletTransaction.update({
      where: { id: row.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        note: input.reason
          ? `${row.note ?? ''}\nReleased: ${input.reason}`.trim()
          : row.note,
      },
    });

    await publishDomainEvent('wallet.transaction.released', {
      transactionId: updated.id,
      walletId: updated.walletId,
      type: updated.type,
      referenceId: updated.referenceId,
      amount: updated.amount,
    });

    return { id: updated.id, alreadyApplied: false };
  });
}

/**
 * Reverse a COMMITTED transaction (e.g. dispute resolution, sender-
 * initiated cancellation after payment commit). Creates a compensating
 * row of opposite direction, also COMMITTED.
 */
export async function reverseTransaction(input: {
  transactionId: string;
  reason: string;
  metadata?: Record<string, unknown>;
  walletPassword?: string;
}): Promise<{ id: string; compensatingId: string }> {
  return runSerializable(async (tx) => {
    const row = await tx.walletTransaction.findUnique({
      where: { id: input.transactionId },
    });
    if (!row) throw new NotFoundError('WalletTransaction not found');

    if (row.status === 'REVERSED') {
      throw new ConflictError(`Transaction ${row.id} already reversed`);
    }
    if (row.status !== 'COMMITTED') {
      throw new ValidationError(
        `Only COMMITTED transactions can be reversed (was ${row.status})`,
      );
    }

    const { key, wallet } = await resolveWalletKey(
      tx,
      row.walletId,
      input.walletPassword,
    );

    // Apply opposite direction: if original was DEBIT, refund CREDIT.
    const reverseDirection: Direction =
      row.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
    if (reverseDirection === 'CREDIT') {
      await resealColumn(tx, wallet.id, 'encryptedBalance', +row.amount, key);
    } else {
      await resealColumn(tx, wallet.id, 'encryptedBalance', -row.amount, key);
    }

    const compensating = await tx.walletTransaction.create({
      data: {
        id: randomUUID(),
        walletId: wallet.id,
        // Map to a granular refinement type so the journal still tells
        // the audit story.
        type:
          row.type === 'PARCEL_SEND'
            ? 'PARCEL_SEND_REFUND'
            : row.type === 'TICKET_PURCHASE'
              ? 'TICKET_REFUND'
              : (row.type as TransactionType),
        status: 'COMMITTED',
        direction: reverseDirection,
        amount: row.amount,
        referenceId: row.referenceId,
        note: `Reverse of ${row.id}: ${input.reason}`,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        committedAt: new Date(),
      },
    });

    await tx.walletTransaction.update({
      where: { id: row.id },
      data: {
        status: 'REVERSED',
        reversedAt: new Date(),
      },
    });

    await publishDomainEvent('wallet.transaction.reversed', {
      transactionId: row.id,
      compensatingTransactionId: compensating.id,
      walletId: row.walletId,
      type: row.type,
      referenceId: row.referenceId,
      amount: row.amount,
    });

    return { id: row.id, compensatingId: compensating.id };
  });
}

/**
 * List the history of a wallet, paginated, oldest-first.
 */
export async function listWalletHistory(walletId: string, limit: number) {
  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    throw new ValidationError('limit must be 1..200');
  }
  return db.walletTransaction.findMany({
    where: { walletId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
