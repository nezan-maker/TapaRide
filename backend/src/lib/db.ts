import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

import { logger } from './logger.js';

const connectionString = `${process.env['DATABASE_URL']}`;

const adapter = new PrismaNeon({ connectionString });

// Singleton pattern — reuse the same connection across the app.
// In development, attach to `global` to prevent multiple instances
// from hot-reloading (tsx watch).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prismaLogging =
  process.env['NODE_ENV'] === 'development'
    ? [
        { emit: 'event' as const, level: 'query' as const },
        { emit: 'event' as const, level: 'warn' as const },
        { emit: 'event' as const, level: 'error' as const },
      ]
    : [{ emit: 'event' as const, level: 'error' as const }];

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: prismaLogging,
  });

if (process.env['NODE_ENV'] === 'development') {
  (db as PrismaClient).$on('query' as never, (event: Prisma.QueryEvent) => {
    logger.debug({
      component: 'prisma',
      query: event.query.replace(/\s+/g, ' ').trim(),
      durationMs: event.duration,
      params:
        event.params && event.params !== '[]'
          ? event.params.length > 160
            ? `${event.params.slice(0, 157)}...`
            : event.params
          : undefined,
    }, 'Prisma query');
  });

  (db as PrismaClient).$on('warn' as never, (event: Prisma.LogEvent) => {
    logger.warn({
      component: 'prisma',
      target: event.target,
    }, event.message);
  });
}

(db as PrismaClient).$on('error' as never, (event: Prisma.LogEvent) => {
  logger.error({
    component: 'prisma',
    target: event.target,
  }, event.message);
});

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Run a Prisma transaction with built‑in retry logic.
 * Guarantees up to 5 attempts, exponential back‑off + jitter,
 * retries on P2034, SQLSTATE 40001, or deadlock messages.
 */
export async function runTransactionWithRetry<T>(
  txFn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 5;
  const baseDelayMs = options?.baseDelayMs ?? 50;
  const isolationLevel = options?.isolationLevel;
  let attempt = 0;

  while (true) {
    try {
      return await db.$transaction(txFn, { isolationLevel });
    } catch (error: any) {
      const isSerializationError =
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
        (error.message &&
          (error.message.includes('40001') || error.message.includes('deadlock')));

      if (isSerializationError && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000, baseDelayMs * Math.pow(2, attempt)) + Math.random() * 50;
        logger.warn(
          { attempt, maxRetries, delayMs: delay, error: error.message || String(error) },
          'Transaction serialization failure or deadlock. Retrying...'
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}

/**
 * Shorthand for serializable transactions.
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return runTransactionWithRetry(fn, {
    maxRetries: 5,
    baseDelayMs: 80,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
