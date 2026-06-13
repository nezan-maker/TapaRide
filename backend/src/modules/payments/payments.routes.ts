import { Router } from 'express';
import { authenticate, requireVerifiedAccount } from '../../plugins/rbac.js';
import * as PaymentsController from './payments.controller.js';

const router = Router();

router.post('/create-intent', authenticate, requireVerifiedAccount, PaymentsController.createIntent);
router.post('/confirm', authenticate, requireVerifiedAccount, PaymentsController.confirmIntent);
router.get('/status', PaymentsController.getPaymentStatus);

export default router;
