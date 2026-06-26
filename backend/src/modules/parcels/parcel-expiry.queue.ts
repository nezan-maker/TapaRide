import { Queue } from 'bullmq';
import { redis } from '../../lib/redis.js';

export const PARCEL_EXPIRY_QUEUE_NAME = 'parcel-expiry';

/**
 * Job data: empty — the worker scans all expired parcels on each tick.
 * We don't pass individual parcel IDs because the expiry window is
 * continuous; a scan is more robust than per-parcel scheduling.
 */
export type ParcelExpiryJob = {
  kind: 'scan-expired';
};

let parcelExpiryQueue: Queue<ParcelExpiryJob, void, string> | null = null;

export function getParcelExpiryQueue(): Queue<ParcelExpiryJob, void, string> {
  if (!parcelExpiryQueue) {
    parcelExpiryQueue = new Queue<ParcelExpiryJob, void, string>(PARCEL_EXPIRY_QUEUE_NAME, {
      connection: redis as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return parcelExpiryQueue;
}

/**
 * Schedule the recurring expiry scan. Idempotent — calling this multiple
 * times won't create duplicate repeatable jobs (BullMQ dedupes by key).
 *
 * Runs every 15 minutes. Each run scans for parcels where:
 *   status = 'CONFIRMED' AND expiresAt < now()
 * and calls expireParcel() on each.
 */
export async function scheduleParcelExpiryScan(): Promise<void> {
  const queue = getParcelExpiryQueue();

  await queue.add(
    'scan-expired',
    { kind: 'scan-expired' },
    {
      repeat: {
        pattern: '*/15 * * * *', // every 15 minutes
      },
      jobId: 'parcel-expiry-scan', // stable ID prevents duplicates
    },
  );
}
