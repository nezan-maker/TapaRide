import { Router } from 'express';
import { authenticate, requireRoles, requireVerifiedAccount } from '../../plugins/rbac.js';
import { createUserAwareRateLimiter } from '../../lib/rate-limit.js';
import * as WaitlistController from './waitlist.controller.js';

const router = Router();
const waitlistReadLimiter = createUserAwareRateLimiter(30, 15 * 60 * 1000);
const waitlistWriteLimiter = createUserAwareRateLimiter(10, 15 * 60 * 1000);

router.post('/', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), waitlistWriteLimiter, WaitlistController.addToWaitlist);
router.get('/my', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), waitlistReadLimiter, WaitlistController.getMyWaitlist);
router.get('/status', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), waitlistReadLimiter, WaitlistController.getStatus);
router.post('/approve-alighting', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), waitlistWriteLimiter, WaitlistController.approveAlighting);
router.delete('/:id', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), waitlistWriteLimiter, WaitlistController.cancelWaitlistEntry);

export default router;
