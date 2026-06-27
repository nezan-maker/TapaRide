import { z } from 'zod';
import { Role } from '@prisma/client';

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phone: z.string().regex(/^\\+?[1-9]\\d{7,14}$/, 'Invalid phone number').optional(),
  role: z.nativeEnum(Role).optional().default('CLIENT'),
  // Required only for DRIVER and MANAGER
  agencyIssuedId: z.string().optional(),
  // Required only for OWNER
  ruraCode: z.string().optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;

// ─── OTP Verification ────────────────────────────────────────────────────────

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
  code: z.string().length(6),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

// ─── Email Verification ───────────────────────────────────────────────────────

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

// ─── Password Recovery ────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
});

export const resetPasswordSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
  code: z.string().length(6),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

// ─── Change Password ─────────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

// ─── WebAuthn ─────────────────────────────────────────────────────────────────

export const webAuthnVerifySchema = z.object({
  credential: z.record(z.string(), z.unknown()), // Raw WebAuthn credential response
});

// ─── OAuth ────────────────────────────────────────────────────────────────────

export const oauthSchema = z.object({
  idToken: z.string().min(1),
});

// ─── Accept Invite ────────────────────────────────────────────────────────────

export const acceptInviteSchema = z.object({
  email: z.string().email(),
  token: z.string().min(8),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type OauthDto = z.infer<typeof oauthSchema>;

