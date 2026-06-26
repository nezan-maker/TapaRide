import { Worker } from 'bullmq';
import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import { expireParcel } from './parcels.service.js';
import { PARCEL_EXPIRY_QUEUE_NAME, type ParcelExpiryJob } from './parcel-expiry.queue.js';

/**
 * Parcel expiry worker.
 *
 * Runs every 15 minutes. Scans for CONFIRMED parcels whose claim window
 * has passed (expiresAt < now) and transitions them to EXPIRED,
 * releasing the wallet hold back to the sender.
 */
export function startParcelExpiryWorker(): Worker<ParcelExpiryJob> {
  const worker = new Worker<ParcelExpiryJob>(
    PARCEL_EXPIRY_QUEUE_NAME,
    async (job) => {
      if (job.data.kind !== 'scan-expired') {
        logger.warn({ jobData: job.data }, 'Unknown parcel expiry job kind');
        return;
      }

      const now = new Date();

      // Find all confirmed parcels past their expiry window
      const expiredParcels = await db.parcel.findMany({
        where: {
          status: 'CONFIRMED',
          expiresAt: { lt: now },
        },
        select: { id: true },
      });

      if (expiredParcels.length === 0) {
        return { expired: 0 };
      }

      let count = 0;
      for (const parcel of expiredParcels) {
        try {
          await expireParcel(parcel.id);
          count++;
        } catch (err) {
          logger.error({ parcelId: parcel.id, err }, 'Failed to expire parcel');
          // Continue with next parcel — don't let one failure block the batch
        }
      }

      logger.info({ count, total: expiredParcels.length }, 'Parcel expiry scan complete');
      return { expired: count };
    },
    {
      connection: redis as any,
      concurrency: 1, // single-threaded scan is safe and simple
    },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Parcel expiry scan completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Parcel expiry scan failed');
  });

  logger.info('Parcel expiry worker started (15min cron)');
  return worker;
}
