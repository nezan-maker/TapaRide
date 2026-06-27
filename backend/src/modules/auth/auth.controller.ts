import { Request, Response, NextFunction } from 'express';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { redis } from '../../lib/redis.js';
import { ValidationError } from '../../lib/errors.js';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  verifyEmailSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  oauthSchema,
  acceptInviteSchema,
} from './auth.schema.js';
import * as AuthService from './auth.service.js';

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = registerSchema.parse(req.body);
    const result = await AuthService.registerUser(dto);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = verifyEmailSchema.parse(req.query);
    const result = await AuthService.verifyEmail(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── OTP Verification ────────────────────────────────────────────────────────

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = verifyOtpSchema.parse(req.body);
    const result = await AuthService.verifyPhone(dto.phone, dto.code);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await AuthService.loginUser(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const result = await AuthService.refreshTokens(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const result = await AuthService.logoutUser(user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Forgot Password ─────────────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone } = forgotPasswordSchema.parse(req.body);
    const result = await AuthService.forgotPassword(phone);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = resetPasswordSchema.parse(req.body);
    const result = await AuthService.resetPassword(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Change Password ─────────────────────────────────────────────────────────

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = changePasswordSchema.parse(req.body);
    const result = await AuthService.changePassword(user.id, dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/accept-invite
 * Accept an email invitation to join as MANAGER or DRIVER.
 */
export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, token, password } = acceptInviteSchema.parse(req.body);
    const result = await AuthService.acceptInvite(email.toLowerCase().trim(), token.trim(), password);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── WebAuthn ─────────────────────────────────────────────────────────────────

const CHALLENGE_TTL_SECONDS = 5 * 60;

function getChallengeKey(scope: string, userId: string) {
  return `webauthn:challenge:${scope}:${userId}`;
}

export async function passkeyRegisterOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const options = await AuthService.generatePasskeyRegistrationOptions(user.id);
    await redis.set(
      getChallengeKey('register', user.id),
      options.challenge,
      'EX',
      CHALLENGE_TTL_SECONDS,
    );
    res.json(options);
  } catch (error) {
    next(error);
  }
}

export async function passkeyRegisterVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const credential = req.body as RegistrationResponseJSON;
    const challengeKey = getChallengeKey('register', user.id);
    const challenge = await redis.get(challengeKey);
    if (!challenge) return next(new ValidationError('No pending registration challenge'));
    await redis.del(challengeKey);
    const result = await AuthService.verifyPasskeyRegistration(user.id, credential, challenge);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function passkeyAuthOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.query as { userId: string };
    const options = await AuthService.generatePasskeyAuthOptions(userId);
    await redis.set(
      getChallengeKey('auth', userId),
      options.challenge,
      'EX',
      CHALLENGE_TTL_SECONDS,
    );
    res.json(options);
  } catch (error) {
    next(error);
  }
}

export async function passkeyAuthVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, credential } = req.body as { userId: string; credential: AuthenticationResponseJSON };
    const challengeKey = getChallengeKey('auth', userId);
    const challenge = await redis.get(challengeKey);
    if (!challenge) return next(new ValidationError('No pending authentication challenge'));
    await redis.del(challengeKey);
    const result = await AuthService.verifyPasskeyAuthentication(userId, credential, challenge);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── OAuth Social Login ───────────────────────────────────────────────────────

export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = oauthSchema.parse(req.body);
    const result = await AuthService.loginWithGoogle(idToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function appleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = oauthSchema.parse(req.body);
    const result = await AuthService.loginWithApple(idToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Onboarding (Google OAuth + normal password auth) ───────────────────────

export async function onboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { phone, walletPassword } = req.body as { phone?: string; walletPassword: string };

    if (!walletPassword) {
      throw new ValidationError('Wallet password is required');
    }

    const result = await AuthService.completeOnboarding(user.id, phone, walletPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
