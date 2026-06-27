import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../plugins/rbac.js';
import * as AuthController from './auth.controller.js';

const router = Router();

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Public routes ────────────────────────────────────────────────────────
router.post('/register', authWriteLimiter, AuthController.register);
router.get('/verify-email', otpLimiter, AuthController.verifyEmail);
router.post('/login', authWriteLimiter, AuthController.login);
router.post('/refresh', authWriteLimiter, AuthController.refresh);
router.post('/forgot-password', otpLimiter, AuthController.forgotPassword);
router.post('/reset-password', otpLimiter, AuthController.resetPassword);

// ─── OAuth Social Login ───────────────────────────────────────────────────────
router.post('/google', authWriteLimiter, AuthController.googleLogin);
router.post('/apple', authWriteLimiter, AuthController.appleLogin);

// ─── WebAuthn – auth options (pre-login, no JWT required) ─────────────────
router.get('/passkey/auth-options', authWriteLimiter, AuthController.passkeyAuthOptions);
router.post('/passkey/auth-verify', authWriteLimiter, AuthController.passkeyAuthVerify);

// ─── WebAuthn – registration (JWT required — user must be logged in) ───────
router.get('/passkey/register-options', authenticate, AuthController.passkeyRegisterOptions);
router.post('/passkey/register-verify', authenticate, AuthController.passkeyRegisterVerify);

// ─── Authenticated routes ────────────────────────────────────────────────
router.post('/onboarding', authenticate, AuthController.onboarding);
router.post('/send-phone-otp', authenticate, AuthController.sendPhoneOtp);
router.post('/verify-otp', authenticate, AuthController.verifyOtp);
router.post('/change-password', authWriteLimiter, authenticate, AuthController.changePassword);
router.post('/logout', authenticate, AuthController.logout);

// ─── Invite acceptance (no auth — user hasn't signed up yet) ─────────────
router.post('/accept-invite', authWriteLimiter, AuthController.acceptInvite);

export default router;