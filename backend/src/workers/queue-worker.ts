import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { startNotificationWorker } from '../lib/notifications/worker.js';
import { startWaitlistWorker } from '../modules/waitlist/waitlist.worker.js';
import { startParcelExpiryWorker } from '../modules/parcels/parcel-expiry.worker.js';
import { scheduleParcelExpiryScan } from '../modules/parcels/parcel-expiry.queue.js';

async function main() {
  await db.$connect();
  await db.$queryRaw`SELECT 1`;
  logger.info('Queue worker connected to database');

  const workers = [
    startNotificationWorker(),
    startWaitlistWorker(),
    startParcelExpiryWorker(),
  ];

  // Schedule recurring jobs (idempotent)
  await scheduleParcelExpiryScan();

  const shutdown = async () => {
    logger.info('Shutting down queue worker');
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(async (error) => {
  logger.error({ err: error }, 'Failed to start queue worker');
  await db.$disconnect();
  process.exit(1);
});
