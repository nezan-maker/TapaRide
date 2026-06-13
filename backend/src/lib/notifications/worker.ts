import { Job, Worker } from 'bullmq';

import { logger } from '../logger.js';
import type { NotificationJob } from './queue.js';
import { NOTIFICATIONS_QUEUE_NAME } from './queue.js';
import { deliverEmail, deliverSms } from './providers.js';
import { redis } from '../redis.js';

export function startNotificationWorker() {
  const worker = new Worker(
    NOTIFICATIONS_QUEUE_NAME,
    async (job: Job<NotificationJob>) => {
      if (job.data.kind === 'email') {
        await deliverEmail(job.data);
        return;
      }

      await deliverSms({
        phone: job.data.phone,
        message: job.data.message,
      });
    },
    {
      connection: redis as any,
      concurrency: 10,
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, name: job.name, queue: NOTIFICATIONS_QUEUE_NAME },
      'Notification job completed',
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      {
        err: error,
        jobId: job?.id,
        name: job?.name,
        queue: NOTIFICATIONS_QUEUE_NAME,
        attemptsMade: job?.attemptsMade,
      },
      'Notification job failed',
    );
  });

  return worker;
}
