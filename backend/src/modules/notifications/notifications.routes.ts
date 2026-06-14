import { Router } from 'express';
import { authenticate } from '../../plugins/rbac.js';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  type Notification,
} from './notifications.service.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/notifications
 *
 * Returns the most recent 50 in-app notifications for the current user,
 * newest first. Each entry has a stable `id`, a `type` (one of
 * "TRIP" | "PARCEL" | "PROMO" | "SYSTEM"), a `title`, a `message`,
 * a `read` flag, and a `createdAt` ISO timestamp.
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = (req.user as { id: string }).id;
    const list: Notification[] = await getUserNotifications(userId, 50);
    const unread = await getUnreadCount(userId);
    res.json({ items: list, unreadCount: unread });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/:id/read
 *
 * Marks a single notification as read for the current user.
 * No-op if the id doesn't belong to the user.
 */
router.post('/:id/read', async (req, res, next) => {
  try {
    const userId = (req.user as { id: string }).id;
    await markAsRead(userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/read-all
 *
 * Marks every notification for the current user as read in one call.
 */
router.post('/read-all', async (req, res, next) => {
  try {
    const userId = (req.user as { id: string }).id;
    const n = await markAllAsRead(userId);
    res.json({ ok: true, updated: n });
  } catch (err) {
    next(err);
  }
});

export default router;
