import { Prisma, IdempotencyState } from '@prisma/client';
import type { Request } from 'express';
import { createHmac } from 'crypto';

import { db } from './db.js';
import { env } from '../config/env.js';
import {
  ConflictError,
  InternalServerError,
  ValidationError,
} from './errors.js';

function toStoredJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

function buildRequestHash(body: unknown): string {
  return createHmac('sha256', env.HMAC_SECRET)
    .update(stableStringify(body))
    .digest('hex');
}

export function requireIdempotencyKey(req: Request) {
  const key = req.header('idempotency-key');
  if (!key) {
    throw new ValidationError(
      'Idempotency-Key header is required for this endpoint',
    );
  }

  return key;
}

export async function runIdempotentMutation<TResult>(options: {
  userId: string;
  route: string;
  idempotencyKey: string;
  requestBody: unknown;
  execute: () => Promise<{ statusCode: number; body: TResult }>;
}) {
  const requestHash = buildRequestHash(options.requestBody);
  const uniqueWhere = {
    userId_route_key: {
      userId: options.userId,
      route: options.route,
      key: options.idempotencyKey,
    },
  };

  const existing = await db.idempotencyKey.findUnique({ where: uniqueWhere });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ConflictError(
        'This idempotency key was already used with a different payload',
      );
    }

    if (existing.state === IdempotencyState.COMPLETED) {
      return {
        replay: true,
        statusCode: existing.statusCode ?? 200,
        body: existing.responseBody as TResult,
      };
    }

    if (existing.state === IdempotencyState.PROCESSING) {
      throw new ConflictError('This request is already being processed');
    }

    if (existing.state === IdempotencyState.FAILED) {
      // Allow retry by deleting the failed idempotency record so a new one is created
      await db.idempotencyKey.delete({ where: uniqueWhere });
    } else {
      throw new InternalServerError('Idempotency record is in an invalid state');
    }
  }

  try {
    await db.idempotencyKey.create({
      data: {
        userId: options.userId,
        route: options.route,
        key: options.idempotencyKey,
        requestHash,
        state: IdempotencyState.PROCESSING,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('This request is already being processed');
    }

    throw error;
  }

  try {
    const result = await options.execute();

    await db.idempotencyKey.update({
      where: uniqueWhere,
      data: {
        state: IdempotencyState.COMPLETED,
        statusCode: result.statusCode,
        responseBody: toStoredJson(result.body),
      },
    });

    return {
      replay: false,
      statusCode: result.statusCode,
      body: result.body,
    };
  } catch (error) {
    await db.idempotencyKey.update({
      where: uniqueWhere,
      data: {
        state: IdempotencyState.FAILED,
      },
    });
    throw error;
  }
}

/**
 * Deletes idempotency keys older than the specified TTL.
 * Call this from a scheduled job (e.g., daily cron) to prevent unbounded growth.
 */
export async function cleanupIdempotencyKeys(maxAgeHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const result = await db.idempotencyKey.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
