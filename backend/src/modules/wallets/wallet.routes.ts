import { Router } from 'express';
import { authenticate, requireVerifiedAccount } from '../../plugins/rbac.js';
import { createUserAwareRateLimiter } from '../../lib/rate-limit.js';
import * as WalletController from './wallet.controller.js';

const router = Router();
const walletReadLimiter = createUserAwareRateLimiter(30, 15 * 60 * 1000);
const walletWriteLimiter = createUserAwareRateLimiter(15, 15 * 60 * 1000);

router.post('/setup', authenticate, requireVerifiedAccount, walletWriteLimiter, WalletController.setupWallet);
router.post('/unlock', authenticate, requireVerifiedAccount, walletWriteLimiter, WalletController.unlockWallet);
router.post('/balance', authenticate, requireVerifiedAccount, walletReadLimiter, WalletController.getBalance);
router.post('/deposit', authenticate, requireVerifiedAccount, walletWriteLimiter, WalletController.deposit);
router.post('/withdraw', authenticate, requireVerifiedAccount, walletWriteLimiter, WalletController.withdraw);
router.get('/transactions', authenticate, requireVerifiedAccount, walletReadLimiter, WalletController.getTransactions);
router.post('/change-password', authenticate, requireVerifiedAccount, walletWriteLimiter, WalletController.changePassword);
router.get('/', authenticate, requireVerifiedAccount, walletReadLimiter, WalletController.getWalletStatus);

export default router;
