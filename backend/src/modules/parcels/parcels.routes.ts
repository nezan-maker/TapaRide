import { Router } from 'express';
import { authenticate, requireRoles, requireVerifiedAccount } from '../../plugins/rbac.js';
import * as ParcelsController from './parcels.controller.js';

const router = Router();

// Public — receiver claim flow (no Tapa account required)
router.post('/claim/start', ParcelsController.startClaim);
router.post('/claim', ParcelsController.claimParcel);

// Public tracking — anyone with tracking code can check status
router.get('/track/:code', ParcelsController.trackParcel);

router.get(
  '/quote',
  authenticate,
  requireVerifiedAccount,
  requireRoles('CLIENT'),
  ParcelsController.quoteParcel,
);
router.get('/my', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ParcelsController.myParcels);
router.post('/', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ParcelsController.createParcel);
router.post(
  '/:id/cancel',
  authenticate,
  requireVerifiedAccount,
  requireRoles('CLIENT'),
  ParcelsController.cancelParcel,
);
router.patch(
  '/:id/status',
  authenticate,
  requireVerifiedAccount,
  requireRoles('DRIVER', 'MANAGER', 'OWNER'),
  ParcelsController.updateStatus,
);

export default router;
