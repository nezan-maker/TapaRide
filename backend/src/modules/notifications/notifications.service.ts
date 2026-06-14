import { randomUUID } from 'crypto';

import { redis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import { onDomainEvent, startDomainEventSubscriber } from '../../lib/domain-events.js';

/**
 * In-app notification store, backed by a Redis list per user.
 *
 *   key:   notif:user:{userId}
 *   value: JSON-serialised Notification (newest at the head via LPUSH)
 *   ttl:   30 days — older entries are evicted lazily on read.
 *
 * The system is fed by domain events published elsewhere in the
 * application (see `lib/domain-events.ts`). The frontend just GETs
 * `/api/notifications` to read them.
 */

export type NotificationType = 'TRIP' | 'PARCEL' | 'PROMO' | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string; // ISO 8601
  /** Optional link target — e.g. /dashboard/trips */
  href?: string;
}

const NOTIF_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const NOTIF_KEY = (userId: string) => `notif:user:${userId}`;
const NOTIF_UNREAD_KEY = (userId: string) => `notif:unread:${userId}`;

async function push(userId: string, n: Omit<Notification, 'id' | 'createdAt' | 'read'> & { read?: boolean }): Promise<Notification> {
  const full: Notification = {
    id: randomUUID(),
    read: n.read ?? false,
    createdAt: new Date().toISOString(),
    type: n.type,
    title: n.title,
    message: n.message,
    href: n.href,
  };
  const key = NOTIF_KEY(userId);
  await redis.lpush(key, JSON.stringify(full));
  await redis.expire(key, NOTIF_TTL_SECONDS);
  if (!full.read) {
    await redis.incr(NOTIF_UNREAD_KEY(userId));
    await redis.expire(NOTIF_UNREAD_KEY(userId), NOTIF_TTL_SECONDS);
  }
  return full;
}

/** Public helper for other modules to publish a notification. */
export async function publishNotification(userId: string, n: Parameters<typeof push>[1]): Promise<Notification> {
  return push(userId, n);
}

export async function getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const raw = await redis.lrange(NOTIF_KEY(userId), 0, limit - 1);
  return raw.map((s) => {
    try {
      return JSON.parse(s) as Notification;
    } catch {
      return null;
    }
  }).filter((n): n is Notification => !!n);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const v = await redis.get(NOTIF_UNREAD_KEY(userId));
  return v ? parseInt(v, 10) || 0 : 0;
}

export async function markAsRead(userId: string, id: string): Promise<void> {
  const key = NOTIF_KEY(userId);
  const raw = await redis.lrange(key, 0, -1);
  for (let i = 0; i < raw.length; i++) {
    let n: Notification;
    try {
      n = JSON.parse(raw[i]);
    } catch {
      continue;
    }
    if (n.id === id && !n.read) {
      n.read = true;
      await redis.lset(key, i, JSON.stringify(n));
      await redis.decr(NOTIF_UNREAD_KEY(userId));
      return;
    }
  }
}

export async function markAllAsRead(userId: string): Promise<number> {
  const key = NOTIF_KEY(userId);
  const raw = await redis.lrange(key, 0, -1);
  let updated = 0;
  for (let i = 0; i < raw.length; i++) {
    let n: Notification;
    try {
      n = JSON.parse(raw[i]);
    } catch {
      continue;
    }
    if (!n.read) {
      n.read = true;
      await redis.lset(key, i, JSON.stringify(n));
      updated += 1;
    }
  }
  if (updated > 0) {
    await redis.set(NOTIF_UNREAD_KEY(userId), '0');
  }
  return updated;
}

/**
 * Subscribe to the existing domain-event channel and turn interesting
 * events into user-visible notifications. Idempotent — safe to call
 * more than once, only the first call wires handlers.
 */
let started = false;
export function startNotificationListeners(): void {
  if (started) return;
  started = true;

  // Kick off the underlying pub/sub if it isn't already running.
  startDomainEventSubscriber().catch((err) => {
    logger.error({ err }, 'Failed to start domain-event subscriber for notifications');
  });

  onDomainEvent('ticket.created', async (event) => {
    try {
      await push(event.payload.userId, {
        type: 'TRIP',
        title: 'Ticket confirmed',
        message: 'Your seat is booked. Open the app to view your e-ticket.',
        href: '/dashboard/trips',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to publish ticket.created notification');
    }
  });

  onDomainEvent('ticket.cancelled', async (event) => {
    try {
      await push(event.payload.userId, {
        type: 'TRIP',
        title: 'Ticket cancelled',
        message: 'Your ticket has been cancelled and any wallet hold has been released.',
        href: '/dashboard/trips',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to publish ticket.cancelled notification');
    }
  });

  onDomainEvent('parcel.created', async (event) => {
    try {
      await push(event.payload.senderId, {
        type: 'PARCEL',
        title: 'Parcel received',
        message: 'Your parcel is queued for pickup. Track it in My Parcels.',
        href: '/dashboard/parcels',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to publish parcel.created notification');
    }
  });

  onDomainEvent('parcel.updated', async (event) => {
    try {
      await push(event.payload.senderId, {
        type: 'PARCEL',
        title: 'Parcel update',
        message: 'Your parcel status changed. Tap to view tracking details.',
        href: `/track/${encodeURIComponent(event.payload.trackingCode)}`,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to publish parcel.updated notification');
    }
  });

  onDomainEvent('wallet.transactions-changed', async (event) => {
    try {
      await push(event.payload.userId, {
        type: 'SYSTEM',
        title: 'Wallet activity',
        message: 'Your wallet balance has changed. Review the latest transactions.',
        href: '/dashboard/payments',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to publish wallet notification');
    }
  });
}
