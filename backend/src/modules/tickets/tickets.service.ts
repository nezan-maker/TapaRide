// src/modules/tickets/tickets.service.ts
import { Prisma } from "@prisma/client";

import { db, runSerializable } from "../../lib/db.js";
import { rememberJson } from "../../lib/cache.js";
import { cacheKeys, cacheTags } from "../../lib/cache-keys.js";
import { cachePolicies } from "../../lib/cache-policies.js";
import { comparePassword, encryptWalletBalance, decryptWalletBalance } from "../../lib/crypto-pool.js";
import { publishDomainEvent } from "../../lib/domain-events.js";
import { redis } from "../../lib/redis.js";
import { generateQRCode } from "../../lib/qr.js";
import { assertUuid } from "../../lib/uuid-validate.js";
import type { PaginationInput } from "../../lib/pagination.js";
import { toPagination } from "../../lib/pagination.js";
import type { BuyTicketDto } from "./tickets.schema.js";
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from "../../lib/errors.js";

async function acquireJourneySeatLock(
  tx: Prisma.TransactionClient,
  journeyId: string,
  seatNumber: number,
) {
  assertUuid(journeyId, 'journeyId');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`journey:${journeyId}:seat:${seatNumber}`}))`;
}

async function acquireWalletLock(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  assertUuid(userId, 'userId');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${userId}`}))`;
}

async function resolveWalletCredential(
  wallet: { walletPassword: string | null },
  userId: string,
  walletPassword?: string,
): Promise<string | Buffer> {
  if (walletPassword) {
    if (!wallet.walletPassword) {
      throw new ValidationError("Wallet setup required");
    }
    const validPassword = await comparePassword(walletPassword, wallet.walletPassword);
    if (!validPassword) throw new AuthenticationError("Incorrect wallet password");
    return walletPassword;
  }

  const cachedKey = await redis.get(`wallet:unlock-key:${userId}`);
  if (!cachedKey) {
    throw new AuthenticationError("Wallet is locked. Please unlock the wallet or supply password.");
  }
  return Buffer.from(cachedKey, 'base64');
}

/**
 * Purchases a ticket using the user's wallet balance.
 * Requires the dedicated wallet password for authorization.
 */
export async function buyTicket(userId: string, dto: BuyTicketDto) {
  // ─── Step 1: Fetch all required data ─────────────────────────────────────
  const journey = await db.journey.findUniqueOrThrow({
    where: { id: dto.journeyId },
    include: { vehicle: { select: { capacity: true } } },
  });

  if (dto.seatNumber > journey.vehicle.capacity) {
    throw new ValidationError(
      `Seat ${dto.seatNumber} does not exist. Vehicle capacity: ${journey.vehicle.capacity}`,
    );
  }

  const reservationKey = `reserve:journey:${dto.journeyId}:seat:${dto.seatNumber}`;
  const reservedForUserId = await redis.get(reservationKey);
  if (reservedForUserId && reservedForUserId !== userId) {
    throw new ConflictError("Seat is temporarily reserved for another passenger");
  }

  const purchase = await runSerializable(async (tx: Prisma.TransactionClient) => {
    await acquireJourneySeatLock(tx, dto.journeyId, dto.seatNumber);
    await acquireWalletLock(tx, userId);

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    if (!wallet.walletPassword || !wallet.encryptedBalance) {
      throw new ValidationError("Wallet setup required");
    }

    let keyOrPassword: string | Buffer;
    if (dto.walletPassword) {
      const validPassword = await comparePassword(dto.walletPassword, wallet.walletPassword);
      if (!validPassword) throw new AuthenticationError("Incorrect wallet password");
      keyOrPassword = dto.walletPassword;
    } else {
      const cachedKey = await redis.get(`wallet:unlock-key:${userId}`);
      if (!cachedKey) {
        throw new AuthenticationError("Wallet is locked. Please unlock the wallet or supply password.");
      }
      keyOrPassword = Buffer.from(cachedKey, 'base64');
    }

    const currentBalance = await decryptWalletBalance(
      wallet.encryptedBalance,
      wallet.iv!,
      wallet.authTag!,
      wallet.salt!,
      keyOrPassword,
    );
    if (currentBalance < journey.price) {
      throw new ConflictError(
        `Insufficient wallet balance. Required: ${journey.price}, Available: ${currentBalance}`,
      );
    }

    const seatTaken = await tx.ticket.findFirst({
      where: {
        journeyId: dto.journeyId,
        seatNumber: dto.seatNumber,
        status: 'PAID',
      },
    });
    if (seatTaken) throw new ConflictError(`Seat ${dto.seatNumber} is already taken`);

    const bulkSeatTaken = await tx.bulkPassenger.findFirst({
      where: {
        seatNumber: dto.seatNumber,
        bulkBooking: { journeyId: dto.journeyId },
      },
      select: { id: true },
    });
    if (bulkSeatTaken) throw new ConflictError(`Seat ${dto.seatNumber} is already bulk booked`);

    const newBalance = currentBalance - journey.price;
    const encrypted = await encryptWalletBalance(newBalance, keyOrPassword);

    const newTicket = await tx.ticket.create({
      data: { userId, journeyId: dto.journeyId, seatNumber: dto.seatNumber, status: 'PAID' },
    });

    await tx.wallet.update({
      where: { userId },
      data: {
        encryptedBalance: encrypted.encryptedBalance,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        salt: encrypted.salt,
        version: { increment: 1 },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TICKET_PURCHASE',
        direction: 'DEBIT',
        status: 'COMMITTED',
        amount: journey.price,
        note: `Ticket purchase — Journey ${dto.journeyId} Seat ${dto.seatNumber}`,
      },
    });

    return { ticket: newTicket, newBalance };
  });

  if (reservedForUserId === userId) {
    await Promise.all([
      redis.del(reservationKey),
      db.waitlistEntry.updateMany({
        where: { userId, journeyId: dto.journeyId, status: { in: ["PENDING", "NOTIFIED"] } },
        data: { status: "BOOKED" },
      }),
    ]);
  }

  await Promise.all([
    publishDomainEvent("ticket.created", {
      journeyId: dto.journeyId,
      userId,
    }),
    publishDomainEvent("wallet.transactions-changed", { userId }),
  ]);

  return {
    message: 'Ticket purchased successfully',
    ticket: purchase.ticket,
    remainingBalance: purchase.newBalance,
    qrCode: await generateQRCode({
      type: 'TICKET',
      ticketId: purchase.ticket.id,
      journeyId: dto.journeyId,
      seatNumber: dto.seatNumber,
    }),
  };
}

export async function cancelTicket(ticketId: string, userId: string, walletPassword?: string) {
  const cancellation = await runSerializable(async (tx) => {
    // 1. Fetch ticket reference to get journeyId and seatNumber
    const ticketRef = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { userId: true, journeyId: true, seatNumber: true },
    });

    if (ticketRef.userId !== userId) {
      throw new ConflictError('This ticket does not belong to you');
    }

    // 2. Acquire locks first
    await acquireJourneySeatLock(tx, ticketRef.journeyId, ticketRef.seatNumber);
    await acquireWalletLock(tx, userId);

    // 3. Re-fetch ticket and wallet inside the locks to guarantee fresh, non-stale data
    const ticket = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { journey: { select: { price: true } } },
    });

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    if (!wallet.walletPassword || !wallet.encryptedBalance) {
      throw new ValidationError('Wallet setup required');
    }
    const keyOrPassword = await resolveWalletCredential(
      wallet,
      userId,
      walletPassword,
    );

    if (ticket.status === 'CANCELLED') {
      // Idempotent: return current state without re-processing refund
      const currentBal = await decryptWalletBalance(
        wallet.encryptedBalance,
        wallet.iv!,
        wallet.authTag!,
        wallet.salt!,
        keyOrPassword,
      );
      return {
        message: 'Ticket is already cancelled',
        refundedBalance: currentBal,
        journeyId: ticket.journeyId,
        alreadyCancelled: true,
      };
    }

    const currentBalance = await decryptWalletBalance(
      wallet.encryptedBalance,
      wallet.iv!,
      wallet.authTag!,
      wallet.salt!,
      keyOrPassword,
    );

    const refundedBalance = currentBalance + ticket.journey.price;
    const encrypted = await encryptWalletBalance(refundedBalance, keyOrPassword);

    await tx.ticket.update({ where: { id: ticketId }, data: { status: 'CANCELLED' } });
    await tx.wallet.update({
      where: { userId },
      data: {
        encryptedBalance: encrypted.encryptedBalance,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        salt: encrypted.salt,
        version: { increment: 1 },
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TICKET_REFUND',
        direction: 'CREDIT',
        status: 'COMMITTED',
        amount: ticket.journey.price,
        note: `Refund for ticket ${ticketId}`,
      },
    });

    return {
      refundedBalance,
      journeyId: ticket.journeyId,
    };
  });

  await Promise.all([
    publishDomainEvent("ticket.cancelled", {
      journeyId: cancellation.journeyId,
      userId,
    }),
    publishDomainEvent("wallet.transactions-changed", { userId }),
  ]);

  return { message: 'Ticket cancelled and refund processed', refundedBalance: cancellation.refundedBalance };
}

export async function getUserTickets(
  userId: string,
  pagination: PaginationInput,
) {
  return rememberJson(
    cacheKeys.userTickets(userId, pagination),
    {
      ...cachePolicies.userTickets,
      tags: [cacheTags.userTickets(userId)],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const [tickets, total] = await Promise.all([
        db.ticket.findMany({
          where: { userId },
          include: {
            journey: {
              include: {
                sourceStation: { select: { name: true } },
                destinationStation: { select: { name: true } },
                vehicle: { select: { plateNumber: true, agency: { select: { name: true } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        db.ticket.count({ where: { userId } }),
      ]);

      return {
        items: tickets,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}
