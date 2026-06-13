import { Router } from 'express';
import { authenticate, requireRoles, requireVerifiedAccount } from '../../plugins/rbac.js';
import * as ParcelsController from './parcels.controller.js';

const router = Router();

// Public tracking — anyone with tracking code can check status
router.get('/track/:code', ParcelsController.trackParcel);

router.get('/my', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ParcelsController.myParcels);
router.post('/', authenticate, requireVerifiedAccount, requireRoles('CLIENT'), ParcelsController.createParcel);
router.patch(
  '/:id/status',
  authenticate,
  requireVerifiedAccount,
  requireRoles('DRIVER', 'MANAGER', 'OWNER'),
  ParcelsController.updateStatus,
);

export default router;
