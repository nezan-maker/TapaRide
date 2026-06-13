import { Queue } from 'bullmq';

import { redis } from '../../lib/redis.js';

export const WAITLIST_QUEUE_NAME = 'waitlist-notifications';
const WAITLIST_JOB_ATTEMPTS = 5;
const WAITLIST_BACKOFF_DELAY_MS = 1_000;

export type WaitlistNotificationJob = {
  kind: 'notify-seat' | 'expire-reservation';
  userId: string;
  journeyId: string;
  seatNumber: number;
  boardingStopId: string;
};

let waitlistQueue: Queue<WaitlistNotificationJob, void, string> | null = null;

export function getWaitlistQueue(): Queue<WaitlistNotificationJob, void, string> {
  if (!waitlistQueue) {
    waitlistQueue = new Queue<WaitlistNotificationJob, void, string>(WAITLIST_QUEUE_NAME, {
      connection: redis as any,
      defaultJobOptions: {
        attempts: WAITLIST_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: WAITLIST_BACKOFF_DELAY_MS,
        },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
  }

  return waitlistQueue;
}
