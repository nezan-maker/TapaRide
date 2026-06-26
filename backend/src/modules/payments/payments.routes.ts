import { Router } from 'express';
import { authenticate, requireVerifiedAccount } from '../../plugins/rbac.js';
import * as PaymentsController from './payments.controller.js';

const router = Router();

router.post('/create-intent', authenticate, requireVerifiedAccount, PaymentsController.createIntent);
router.post('/confirm', authenticate, requireVerifiedAccount, PaymentsController.confirmIntent);
router.post('/topup', authenticate, requireVerifiedAccount, PaymentsController.createTopup);
router.post('/topup/confirm', authenticate, requireVerifiedAccount, PaymentsController.confirmTopup);
router.get('/status', PaymentsController.getPaymentStatus);

export default router;
