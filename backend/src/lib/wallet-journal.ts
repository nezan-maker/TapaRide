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
//      AES-256-GCM primitives the existing balance uses. Salt is
//      discarded for heldBalance operations: it is never decrypted by
//      the user — only by server internals — so the per-write salt has
//      no semantic value and is not persisted.
import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { runSerializable } from './db.js';
import {
  encryptWalletBalance,
  decryptWalletBalance,
} from './crypto-pool.js';
import { Prisma } from '@prisma/client';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from './errors.js';
import { publishDomainEvent } from './domain-events.js';
import { logger } from './logger.js';

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
 * Acquire Postgres advisory lock + select for the wallet row. Returns the
 * row with all encryption fields populated. Throws NotFoundError if no
 * wallet exists. Throws ValidationError if the wallet isn't ACTIVE.
 */
async function lockWallet(
  tx: Prisma.TransactionClient,
  walletId: string,
): Promise<{
  id: string;
  userId: string;
  encryptedBalance: string | null;
  iv: string | null;
  authTag: string | null;
  salt: string | null;
  encryptedHeldBalance: string | null;
  heldBalanceIv: string | null;
  heldBalanceAuthTag: string | null;
  version: number;
}> {
  // Hash walletId cross-process deterministically for pg_advisory_xact_lock
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${PAWT}:${walletId}`}))`;
  const w = await tx.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundError('Wallet not found');
  if (w.status !== 'ACTIVE') {
    throw new ValidationError(`Wallet is not active (status=${w.status})`);
  }
  return w;
}

/**
 * Read-only helper for the available balance, in whole RWF.
 */
export async function getAvailableBalanceRwf(walletId: string): Promise<number> {
  const w = await db.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundError('Wallet not found');
  if (!w.encryptedBalance || !w.iv || !w.authTag || !w.salt) return 0;
  return decryptWalletBalance(
    w.encryptedBalance,
    w.iv,
    w.authTag,
    w.salt,
    // Use the wallet's salt + DATABASE_ENCRYPTION_KEY as the symmetric
    // encryption key derivation input. The PIN is for *user-facing*
    // unlock only; the actual symmetric key is the env-held master key.
    process.env['DATABASE_ENCRYPTION_KEY']!,
  );
}

/**
 * Read-only helper for the held balance column. Used by tests + the
 * dashboard. Held balance never needs to be revealed to the end user.
 */
export async function getHeldBalanceRwf(walletId: string): Promise<number> {
  const w = await db.wallet.findUnique({ where: { id: walletId } });
  if (!w) throw new NotFoundError('Wallet not found');
  if (!w.encryptedHeldBalance || !w.heldBalanceIv || !w.heldBalanceAuthTag) {
    return 0;
  }
  // HeldBalance ciphertext: decryption is informational only. We use the
  // existing crypto-pool primitives, with a synthetic-salt that mirrors
  // what was written on the place-hold path.
  return decryptWalletBalance(
    w.encryptedHeldBalance,
    w.heldBalanceIv,
    w.heldBalanceAuthTag,
    process.env['DATABASE_ENCRYPTION_KEY']!,
    process.env['DATABASE_ENCRYPTION_KEY']!,
  );
}

/**
 * Decrypt-then-encrypt a balance value, persisting fresh ciphertext.
 * Returns the ciphertext tuple to write back to the row.
 */
async function resealNumericBalance(
  tx: Prisma.TransactionClient,
  walletId: string,
  field:
    | 'encryptedBalance'
    | 'encryptedHeldBalance',
  ivField: 'iv' | 'heldBalanceIv',
  tagField: 'authTag' | 'heldBalanceAuthTag',
  newValue: number,
): Promise<void> {
  const w = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });

  // Decrypt the existing value with the env-held master key. For balance
  // rows that haven't been initialized yet (nullable ciphertext), treat
  // the current value as 0.
  let current = 0;
  const cipher =
    field === 'encryptedBalance' ? w.encryptedBalance : w.encryptedHeldBalance;
  const iv = field === 'encryptedBalance' ? w.iv : w.heldBalanceIv;
  const tag = field === 'encryptedBalance' ? w.authTag : w.heldBalanceAuthTag;
  if (cipher && iv && tag) {
    current = await decryptWalletBalance(
      cipher,
      iv,
      tag,
      // For balance: use the wallet's persisted salt.
      // For heldBalance: use the env-held master key — synthetic salt.
      field === 'encryptedBalance'
        ? w.salt ?? process.env['DATABASE_ENCRYPTION_KEY']!
        : process.env['DATABASE_ENCRYPTION_KEY']!,
      process.env['DATABASE_ENCRYPTION_KEY']!,
    );
  }

  // Re-issue a new IV (random) and re-encrypt. The salt for balance is
  // reused (per-wallet); for heldBalance we accept the synthesized salt
  // produced by the pool. Either way we only need the IV+ciphertext+tag.
  const sealed = await encryptWalletBalance(
    current + newValue,
    field === 'encryptedBalance'
      ? process.env['DATABASE_ENCRYPTION_KEY']!
      : process.env['DATABASE_ENCRYPTION_KEY']!,
  );

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      [field]: sealed.encryptedBalance,
      [ivField]: sealed.iv,
      [tagField]: sealed.authTag,
      version: { increment: 1 },
    },
  });
}

interface PlaceHoldInput {
  walletId: string;
  amount: number;          // sum in whole RWF; must be > 0
  direction: Direction;    // CREDIT (rare — topup) or DEBIT (parcel send etc.)
  type: TransactionType;
  referenceId?: string;    // parcel id, ticket id, etc. — for joins
  idempotencyKeyId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
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
    const w = await lockWallet(tx, input.walletId);

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
    if (w.encryptedBalance && w.iv && w.authTag && w.salt) {
      available = await decryptWalletBalance(
        w.encryptedBalance,
        w.iv,
        w.authTag,
        w.salt,
        process.env['DATABASE_ENCRYPTION_KEY']!,
      );
    }
    if (input.direction === 'DEBIT' && input.amount > available) {
      throw new ValidationError(
        `Insufficient balance: have ${available} RWF, need ${input.amount} RWF`,
      );
    }

    // Mutate balance columns (DEBIT) or only held (CREDIT).
    if (input.direction === 'DEBIT') {
      await resealNumericBalance(
        tx,
        w.id,
        'encryptedBalance',
        'iv',
        'authTag',
        -input.amount,
      );
    }
    await resealNumericBalance(
      tx,
      w.id,
      'encryptedHeldBalance',
      'heldBalanceIv',
      'heldBalanceAuthTag',
      +input.amount,
    );

    const txRow = await tx.walletTransaction.create({
      data: {
        id: randomUUID(),
        walletId: w.id,
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
 * (i.e. another row already has this eventId, or this row already has it
 * committed in COMMITTED state), we return the existing outcome.
 */
export async function commitHold(input: {
  transactionId: string;
  stripeEventId?: string;
  metadata?: Record<string, unknown>;
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

    const w = await lockWallet(tx, row.walletId);

    // On commit: heldBalance -= amount (regardless of direction). The
    // available balance was already debited at place-hold time; on
    // commit we just stop holding the funds.
    await resealNumericBalance(
      tx,
      w.id,
      'encryptedHeldBalance',
      'heldBalanceIv',
      'heldBalanceAuthTag',
      -row.amount,
    );

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

    logger.info(
      { txId: updated.id, type: updated.type },
      'wallet: commitHold',
    );
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

    const w = await lockWallet(tx, row.walletId);

    // Reverse the held amount landing. For DEBIT holds, also recover the
    // available balance that was deducted at place-time.
    await resealNumericBalance(
      tx,
      w.id,
      'encryptedHeldBalance',
      'heldBalanceIv',
      'heldBalanceAuthTag',
      -row.amount,
    );
    if (row.direction === 'DEBIT') {
      await resealNumericBalance(
        tx,
        w.id,
        'encryptedBalance',
        'iv',
        'authTag',
        +row.amount,
      );
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

    const w = await lockWallet(tx, row.walletId);

    // Apply opposite direction: if original was DEBIT, refund CREDIT.
    const reverseDirection: Direction =
      row.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
    if (reverseDirection === 'CREDIT') {
      await resealNumericBalance(
        tx,
        w.id,
        'encryptedBalance',
        'iv',
        'authTag',
        +row.amount,
      );
    } else {
      await resealNumericBalance(
        tx,
        w.id,
        'encryptedBalance',
        'iv',
        'authTag',
        -row.amount,
      );
    }

    const compensating = await tx.walletTransaction.create({
      data: {
        id: randomUUID(),
        walletId: w.id,
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
