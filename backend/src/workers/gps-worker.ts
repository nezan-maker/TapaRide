import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { aggregateTripGPSWithLock } from '../modules/tracking/tracking.service.js';
import { cleanupIdempotencyKeys } from '../lib/idempotency.js';

let gpsIntervalHandle: NodeJS.Timeout | undefined;
let cleanupIntervalHandle: NodeJS.Timeout | undefined;

async function runGpsAggregation() {
  try {
    await aggregateTripGPSWithLock();
  } catch (error) {
    logger.error({ err: error }, 'GPS aggregation job failed');
  }
}

async function runCleanup() {
  try {
    const deletedCount = await cleanupIdempotencyKeys();
    if (deletedCount > 0) {
      logger.info({ deletedCount }, 'Purged expired idempotency keys');
    }
  } catch (error) {
    logger.error({ err: error }, 'Idempotency key cleanup failed');
  }
}

async function main() {
  await db.$connect();
  await db.$queryRaw`SELECT 1`;
  logger.info('GPS worker connected to database');

  // Initial run
  await runGpsAggregation();

  // GPS aggregation interval
  gpsIntervalHandle = setInterval(runGpsAggregation, env.GPS_AGGREGATION_INTERVAL_MS);

  // Run idempotency key cleanup immediately on start and then every 1 hour
  await runCleanup();
  cleanupIntervalHandle = setInterval(runCleanup, 60 * 60 * 1000); // 1 hour

  const shutdown = async (signal?: string) => {
    logger.info({ signal }, 'Shutting down GPS worker');
    if (gpsIntervalHandle) {
      clearInterval(gpsIntervalHandle);
    }
    if (cleanupIntervalHandle) {
      clearInterval(cleanupIntervalHandle);
    }
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Prevent unhandled errors from crashing the worker
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'GPS worker unhandled rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'GPS worker uncaught exception');
    process.exit(1);
  });
}

main().catch(async (error) => {
  logger.error({ err: error }, 'Failed to start GPS worker');
  await db.$disconnect();
  process.exit(1);
});