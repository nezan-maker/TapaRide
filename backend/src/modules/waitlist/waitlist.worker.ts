import { Job, Worker } from 'bullmq';

import { db } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';
import { redis } from '../../lib/redis.js';
import { publishRealtimeEvent } from '../../lib/socket-bus.js';
import { processWaitlist } from './waitlist.service.js';
import {
  getWaitlistQueue,
  WAITLIST_QUEUE_NAME,
  type WaitlistNotificationJob,
} from './waitlist.queue.js';

const RESERVATION_WINDOW_MS = 3 * 60 * 1000;

export function startWaitlistWorker() {
  const waitlistWorker = new Worker(
    WAITLIST_QUEUE_NAME,
    async (job: Job<WaitlistNotificationJob>) => {
      const { kind, userId, journeyId, seatNumber, boardingStopId } = job.data;

      if (kind === 'expire-reservation') {
        const reservationKey = `reserve:journey:${journeyId}:seat:${seatNumber}`;
        const reservedForUser = await redis.get(reservationKey);
        // If the key is set to a different user, skip expiration.
        // If the key is null (expired in Redis) or set to the current user, proceed.
        if (reservedForUser && reservedForUser !== userId) {
          return;
        }

        await redis.del(reservationKey);
        await db.waitlistEntry.updateMany({
          where: {
            userId,
            journeyId,
            boardingStopId,
            status: 'NOTIFIED',
          },
          data: { status: 'EXPIRED' },
        });
        await processWaitlist(journeyId, boardingStopId, seatNumber);
        return;
      }

      // Try to acquire the reservation in Redis first
      const reservationKey = `reserve:journey:${journeyId}:seat:${seatNumber}`;
      const reservationSet = await redis.set(
        reservationKey,
        userId,
        'PX',
        RESERVATION_WINDOW_MS,
        'NX',
      );
      if (reservationSet !== 'OK') {
        return;
      }

      // Emit socket notification only if we successfully reserved the seat
      await publishRealtimeEvent({
        room: `user:${userId}`,
        event: 'seat:available',
        payload: {
          journeyId,
          seatNumber,
          boardingStopId,
          expiryTime: Date.now() + RESERVATION_WINDOW_MS,
        },
      });

      await getWaitlistQueue().add(
        `expire:${journeyId}:${seatNumber}:${userId}`,
        {
          kind: 'expire-reservation',
          userId,
          journeyId,
          seatNumber,
          boardingStopId,
        },
        {
          delay: RESERVATION_WINDOW_MS,
          attempts: 1,
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      );

      logger.info(
        { userId, journeyId, seatNumber, boardingStopId },
        'Waitlist rider notified about seat availability',
      );
    },
    {
      connection: redis as any,
      concurrency: 5,
    },
  );

  waitlistWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name, queue: WAITLIST_QUEUE_NAME }, 'Waitlist job completed');
  });

  waitlistWorker.on('failed', (job, err) => {
    logger.error(
      {
        err,
        jobId: job?.id,
        name: job?.name,
        queue: WAITLIST_QUEUE_NAME,
        attemptsMade: job?.attemptsMade,
      },
      'Waitlist job failed',
    );
  });

  return waitlistWorker;
}
