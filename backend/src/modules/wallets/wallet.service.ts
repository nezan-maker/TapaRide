// src/modules/wallets/wallet.service.ts
import { Prisma } from "@prisma/client";
import { rememberJson } from "../../lib/cache.js";
import { cacheKeys, cacheTags } from "../../lib/cache-keys.js";
import { cachePolicies } from "../../lib/cache-policies.js";
import { db, runSerializable } from "../../lib/db.js";
import { publishDomainEvent } from "../../lib/domain-events.js";
import { redis } from "../../lib/redis.js";
import {
  hashPassword,
  comparePassword,
  encryptWalletBalance,
  decryptWalletBalance,
  deriveKeyPBKDF2,
} from "../../lib/crypto-pool.js";
import type { PaginationInput } from "../../lib/pagination.js";
import { toPagination } from "../../lib/pagination.js";
import type {
  SetupWalletDto,
  DepositDto,
  WithdrawDto,
  UnlockWalletDto,
} from "./wallet.schema.js";
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from "../../lib/errors.js";

import { assertUuid } from '../../lib/uuid-validate.js';

const BCRYPT_ROUNDS = 12;

async function acquireWalletLock(tx: Prisma.TransactionClient, userId: string) {
  assertUuid(userId, 'userId');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${userId}`}))`;
}

/**
 * Initializes a user's wallet with a dedicated password/PIN.
 */
export async function setupWallet(userId: string, dto: SetupWalletDto) {
  const wallet = await db.wallet.findUniqueOrThrow({ where: { userId } });
  if (wallet.status === 'ACTIVE') {
    throw new ConflictError("Wallet is already initialized");
  }

  const hashedWalletPassword = await hashPassword(
    dto.walletPassword,
    BCRYPT_ROUNDS,
  );

  // Encrypt initial balance (0) using the wallet password
  const encrypted = await encryptWalletBalance(0, dto.walletPassword);

  await db.wallet.update({
    where: { userId },
    data: {
      walletPassword: hashedWalletPassword,
      encryptedBalance: encrypted.encryptedBalance,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      salt: encrypted.salt,
      status: 'ACTIVE',
    },
  });

  await redis.del(`wallet:unlock-key:${userId}`);

  await publishDomainEvent("wallet.transactions-changed", { userId });
  return { message: "Wallet initialized successfully" };
}

/**
 * Unlocks a user's wallet and stores the derived PBKDF2 key in Redis for 15 minutes.
 */
export async function unlockWallet(userId: string, dto: UnlockWalletDto) {
  const wallet = await db.wallet.findUniqueOrThrow({ where: { userId } });
  if (wallet.status !== 'ACTIVE' || !wallet.walletPassword) {
    throw new ValidationError("Wallet is not active");
  }

  const valid = await comparePassword(dto.walletPassword, wallet.walletPassword);
  if (!valid) throw new AuthenticationError("Incorrect wallet password");

  // Derive the 256-bit AES key
  const keyBase64 = await deriveKeyPBKDF2(dto.walletPassword, wallet.salt!);

  // Cache base64 key in Redis for 15 minutes (900 seconds)
  await redis.set(`wallet:unlock-key:${userId}`, keyBase64, 'EX', 900);

  return { message: "Wallet unlocked successfully" };
}

/**
 * Fetches and decrypts the user's wallet balance.
 * The caller must supply either the raw wallet password or have an active unlock session.
 */
export async function getBalance(
  userId: string,
  walletPassword?: string,
): Promise<number> {
  const wallet = await db.wallet.findUniqueOrThrow({ where: { userId } });

  if (!wallet.walletPassword || !wallet.encryptedBalance) {
    throw new ValidationError(
      "Wallet setup required. Please set your wallet password first.",
    );
  }

  let keyOrPassword: string | Buffer;
  if (walletPassword) {
    // Verify wallet password matches stored hash
    const valid = await comparePassword(walletPassword, wallet.walletPassword);
    if (!valid) throw new AuthenticationError("Incorrect wallet password");
    keyOrPassword = walletPassword;
  } else {
    const cachedKey = await redis.get(`wallet:unlock-key:${userId}`);
    if (!cachedKey) {
      throw new AuthenticationError("Wallet is locked. Please unlock the wallet or supply password.");
    }
    keyOrPassword = Buffer.from(cachedKey, 'base64');
  }

  return await decryptWalletBalance(
    wallet.encryptedBalance,
    wallet.iv!,
    wallet.authTag!,
    wallet.salt!,
    keyOrPassword,
  );
}

/**
 * Deposits funds into the wallet.
 */
export async function deposit(userId: string, dto: DepositDto) {
  const newBalance = await runSerializable<number>(async (tx) => {
    await acquireWalletLock(tx, userId);

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    if (!wallet.walletPassword || !wallet.encryptedBalance) {
      throw new ValidationError("Wallet setup required");
    }

    let keyOrPassword: string | Buffer;
    if (dto.walletPassword) {
      const valid = await comparePassword(
        dto.walletPassword,
        wallet.walletPassword,
      );
      if (!valid) throw new AuthenticationError("Incorrect wallet password");
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
    const nextBalance = currentBalance + dto.amount;
    const encrypted = await encryptWalletBalance(
      nextBalance,
      keyOrPassword,
    );

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
        type: "DEPOSIT",
        amount: dto.amount,
        note: "Bank deposit",
      },
    });

    return nextBalance;
  });

  await publishDomainEvent("wallet.transactions-changed", { userId });
  return { message: "Deposit successful", newBalance };
}

/**
 * Withdraws funds from the wallet.
 */
export async function withdraw(userId: string, dto: WithdrawDto) {
  const newBalance = await runSerializable<number>(async (tx) => {
    await acquireWalletLock(tx, userId);

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    if (!wallet.walletPassword || !wallet.encryptedBalance) {
      throw new ValidationError("Wallet setup required");
    }

    let keyOrPassword: string | Buffer;
    if (dto.walletPassword) {
      const valid = await comparePassword(
        dto.walletPassword,
        wallet.walletPassword,
      );
      if (!valid) throw new AuthenticationError("Incorrect wallet password");
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
    if (currentBalance < dto.amount) {
      throw new ConflictError("Insufficient funds");
    }

    const nextBalance = currentBalance - dto.amount;
    const encrypted = await encryptWalletBalance(
      nextBalance,
      keyOrPassword,
    );

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
        type: "WITHDRAWAL",
        amount: dto.amount,
        note: "Withdrawal to bank",
      },
    });

    return nextBalance;
  });

  await publishDomainEvent("wallet.transactions-changed", { userId });
  return { message: "Withdrawal successful", newBalance };
}

/**
 * Change the wallet password (PIN) without affecting the encrypted balance.
 * The caller provides the current wallet password and the new one.
 * The function verifies the old password, decrypts the existing balance,
 * re‑encrypts it with the new password, and updates the stored hash.
 */
export async function changeWalletPassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  return await runSerializable(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    // Verify old wallet password
    const valid = await comparePassword(oldPassword, wallet.walletPassword!);
    if (!valid) throw new AuthenticationError('Incorrect wallet password');

    // Decrypt current balance using old password
    const currentBalance = await decryptWalletBalance(
      wallet.encryptedBalance!,
      wallet.iv!,
      wallet.authTag!,
      wallet.salt!,
      oldPassword,
    );

    // Re‑encrypt balance with the new password
    const encrypted = await encryptWalletBalance(currentBalance, newPassword);
    const newHashed = await hashPassword(newPassword, BCRYPT_ROUNDS);

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        walletPassword: newHashed,
        encryptedBalance: encrypted.encryptedBalance,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        salt: encrypted.salt,
      },
    });

    await redis.del(`wallet:unlock-key:${userId}`);

    await publishDomainEvent('wallet.transactions-changed', { userId });
    return { message: 'Wallet password changed successfully' };
  });
}

/**
 * Returns the wallet transaction history.
 */
export async function getTransactions(
  userId: string,
  pagination: PaginationInput,
) {
  return rememberJson(
    cacheKeys.walletTransactions(userId, pagination),
    {
      ...cachePolicies.walletTransactions,
      tags: [cacheTags.userWalletTransactions(userId)],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const wallet = await db.wallet.findUniqueOrThrow({
        where: { userId },
        select: { id: true },
      });
      const [transactions, total] = await Promise.all([
        db.walletTransaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        db.walletTransaction.count({
          where: { walletId: wallet.id },
        }),
      ]);

      return {
        items: transactions,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}

/**
 * Returns basic wallet status without requiring password.
 */
export async function getWalletStatus(userId: string) {
  try {
    const wallet = await db.wallet.findUniqueOrThrow({
      where: { userId },
      select: { id: true, status: true, createdAt: true },
    });

    // Check if wallet is currently unlocked in Redis
    const isUnlocked = await redis.exists(`wallet:unlock-key:${userId}`);

    return {
      id: wallet.id,
      status: wallet.status,
      createdAt: wallet.createdAt,
      unlocked: isUnlocked === 1,
    };
  } catch {
    return { status: 'UNINITIALIZED', unlocked: false };
  }
}
