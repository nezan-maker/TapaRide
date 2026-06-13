import { Queue } from 'bullmq';

import { redis } from '../redis.js';

export const NOTIFICATIONS_QUEUE_NAME = 'notifications';
const NOTIFICATION_JOB_ATTEMPTS = 5;
const NOTIFICATION_BACKOFF_DELAY_MS = 1_000;

let notificationsQueue: Queue<NotificationJob, void, string> | null = null;

export function getNotificationsQueue(): Queue<NotificationJob, void, string> {
  if (!notificationsQueue) {
    notificationsQueue = new Queue(NOTIFICATIONS_QUEUE_NAME, {
      connection: redis as any,
      defaultJobOptions: {
        attempts: NOTIFICATION_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: NOTIFICATION_BACKOFF_DELAY_MS,
        },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
  }

  return notificationsQueue;
}

export type EmailNotificationJob = {
  kind: 'email';
  to: string;
  subject: string;
  html: string;
};

export type SmsNotificationJob = {
  kind: 'sms';
  phone: string;
  message: string;
};

export type NotificationJob = EmailNotificationJob | SmsNotificationJob;
