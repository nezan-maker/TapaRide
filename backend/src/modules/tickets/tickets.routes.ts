import { Router } from 'express';
import { authenticate, requireRoles, requireVerifiedAccount } from '../../plugins/rbac.js';
import { createUserAwareRateLimiter } from '../../lib/rate-limit.js';
import * as TicketsController from './tickets.controller.js';

const router = Router();
const ticketReadLimiter = createUserAwareRateLimiter(30, 15 * 60 * 1000);
const ticketWriteLimiter = createUserAwareRateLimiter(12, 15 * 60 * 1000);

router.get('/my', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ticketReadLimiter, TicketsController.getMyTickets);
router.post('/', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ticketWriteLimiter, TicketsController.buyTicket);
router.post('/:id/cancel', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ticketWriteLimiter, TicketsController.cancelTicket);

export default router;
