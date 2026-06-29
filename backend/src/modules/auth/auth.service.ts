// src/modules/auth/auth.service.ts
import { Prisma, Passkey, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { redis } from "../../lib/redis.js";

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

import { db } from "../../lib/db.js";
import { env } from "../../config/env.js";
import { generateOtp, verifyOtp } from "../../lib/otp.js";
import { sendVerificationEmail, sendOtpSms } from "../../lib/mailer.js";
import { hashPassword, comparePassword } from "../../lib/crypto-pool.js";
import type { ChangePasswordDto, RegisterDto, LoginDto, ResetPasswordDto } from "./auth.schema.js";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";

const BCRYPT_ROUNDS = 12;

// ─── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function signRefreshToken(payload: { id: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

async function createSession(user: Pick<User, "id" | "email" | "phone" | "role" | "isVerified" | "phoneVerifiedAt">) {
  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });
  const hashedRefresh = createHash("sha256").update(refreshToken).digest("hex");

  await db.user.update({
    where: { id: user.id },
    data: { refreshToken: hashedRefresh },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
    },
  };
}

async function assertPasswordIsNew(user: Pick<User, "passwordHistory">, plainPassword: string) {
  for (const historicHash of user.passwordHistory) {
    const isReuse = await comparePassword(plainPassword, historicHash);
    if (isReuse) {
      throw new ValidationError(
        "Cannot reuse any of your last 5 passwords. Please choose a new one.",
      );
    }
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(dto: RegisterDto) {
  // Validate role-specific requirements
  if (
    (dto.role === "DRIVER" || dto.role === "MANAGER") &&
    !dto.agencyIssuedId
  ) {
    throw new ValidationError(
      "Agency-issued ID is required for DRIVER and MANAGER roles",
    );
  }
  // NOTE: OWNER no longer requires ruraCode at signup — that belongs to the
  // first agency they create from the dashboard. ruraCode is agency-scoped,
  // not user-scoped, so an OWNER can run multiple agencies each with its
  // own RURA license.

  // Check uniqueness
  const existing = await db.user.findFirst({
    where: {
      OR: [
        { email: dto.email },
        { phone: dto.phone },
      ],
    },
  });
  if (existing) {
    throw new ConflictError(
      existing.email === dto.email
        ? "Email already registered"
        : "Phone already registered",
    );
  }

  const hashedPassword = await hashPassword(dto.password, BCRYPT_ROUNDS);

  // Create user and wallet in a transaction
  const user = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const newUser = await tx.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: dto.role,
        agencyIssuedId: dto.agencyIssuedId,
        isVerified: false,
        phoneVerifiedAt: null,
        passwordHistory: [hashedPassword],
      },
    });

    // Create a wallet record — will be initialized later by the user
    await tx.wallet.create({
      data: {
        userId: newUser.id,
      },
    });

    return newUser;
  });

  // Send verification email (phone is stored but NOT verified at signup —
  // phone verification is required only for money-related actions).
  const emailToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: "24h",
  });
  await sendVerificationEmail(user.email, emailToken);

  // In development, return tokens for easy testing/pitching
  const devInfo: Record<string, string> = {};
  if (env.NODE_ENV === "development") {
    const origin = env.EMAIL_VERIFICATION_ORIGIN || env.WEBAUTHN_ORIGIN || 'http://localhost:5175';
    devInfo.verifyEmailLink = `${origin}/verify-email?token=${emailToken}`;
  }

  return {
    message: "Registration successful. Please verify your email.",
    ...devInfo,
  };
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string) {
  const blacklistKey = `email-verification:used:${token}`;
  const isUsed = await redis.get(blacklistKey);
  if (isUsed) {
    throw new AuthenticationError("Email verification token has already been used");
  }

  let payload: { userId: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
  } catch {
    throw new AuthenticationError("Invalid or expired email verification token");
  }

  await db.user.update({
    where: { id: payload.userId },
    data: { isVerified: true },
  });

  // Blacklist the token in Redis. Since the token is valid for 24h,
  // we cache it in Redis for 24h to prevent reuse.
  await redis.set(blacklistKey, "1", "EX", 24 * 3600);

  return { message: "Email verified successfully" };
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

export async function verifyPhone(phone: string, code: string) {
  const valid = await verifyOtp(phone, code);
  if (!valid) throw new AuthenticationError("Invalid or expired OTP");
  await db.user.update({
    where: { phone },
    data: { phoneVerifiedAt: new Date() },
  });
  return { message: "Phone verified successfully" };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginUser(dto: LoginDto) {
  const user = await db.user.findUnique({ where: { email: dto.email } });
  if (!user) throw new AuthenticationError("Invalid credentials");

  const passwordMatch = await comparePassword(dto.password, user.password);
  if (!passwordMatch) throw new AuthenticationError("Invalid credentials");

  if (!user.isVerified) {
    throw new AuthenticationError(
      "Email verification is still pending for this account.",
    );
  }

  return createSession(user);
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export async function refreshTokens(token: string) {
  let payload: { id: string };
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
  } catch {
    throw new AuthenticationError("Invalid or expired refresh token");
  }

  const user = await db.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.refreshToken)
    throw new AuthenticationError("Invalid session");

  const hashedToken = createHash("sha256").update(token).digest("hex");
  const tokenMatch = hashedToken === user.refreshToken;
  if (!tokenMatch) throw new AuthenticationError("Invalid session");

  return createSession(user);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutUser(userId: string) {
  await db.user.update({ where: { id: userId }, data: { refreshToken: null } });
  return { message: "Logged out successfully" };
}

// ─── Forgot / Reset Password ──────────────────────────────────────────────────

export async function forgotPassword(phone: string) {
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    // Don't reveal if phone exists
    return { message: "If that phone is registered, an OTP has been sent" };
  }
  const otp = await generateOtp(phone);
  await sendOtpSms(phone, otp);
  return { message: "If that phone is registered, an OTP has been sent" };
}

export async function resetPassword(dto: ResetPasswordDto) {
  const valid = await verifyOtp(dto.phone, dto.code);
  if (!valid) throw new AuthenticationError("Invalid or expired OTP");

  const user = await db.user.findUnique({ where: { phone: dto.phone } });
  if (!user) throw new ValidationError("User not found");

  await assertPasswordIsNew(user, dto.newPassword);

  const hashed = await hashPassword(dto.newPassword, BCRYPT_ROUNDS);
  const passwordHistory = [...user.passwordHistory, hashed].slice(-5);

  // Update only the authentication password and related fields. Wallet balance is unchanged.
  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      refreshToken: null,
      lastPasswordChangedAt: new Date(),
      passwordHistory,
    },
  });

  return { message: "Password reset successfully. Please log in again." };
}

export async function changePassword(userId: string, dto: ChangePasswordDto) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ValidationError("User not found");

  const passwordMatch = await comparePassword(dto.oldPassword, user.password);
  if (!passwordMatch) throw new AuthenticationError("Current password is incorrect");

  await assertPasswordIsNew(user, dto.newPassword);

  const hashed = await hashPassword(dto.newPassword, BCRYPT_ROUNDS);
  const passwordHistory = [...user.passwordHistory, hashed].slice(-5);

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      refreshToken: null,
      lastPasswordChangedAt: new Date(),
      passwordHistory,
    },
  });

  return { message: "Password changed successfully. Please log in again." };
}

// ─── WebAuthn Registration ────────────────────────────────────────────────────

export async function generatePasskeyRegistrationOptions(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const existingPasskeys = await db.passkey.findMany({ where: { userId } });

  const options = await generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.WEBAUTHN_RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    excludeCredentials: existingPasskeys.map((pk: Passkey) => ({
      id: pk.id,
      transports: [],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  return options;
}

export async function verifyPasskeyRegistration(
  userId: string,
  credential: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AuthenticationError("WebAuthn registration verification failed");
  }

  const { credential: cred } = verification.registrationInfo;

  await db.passkey.create({
    data: {
      id: Buffer.from(cred.id).toString("base64url"),
      userId,
      publicKey: Buffer.from(cred.publicKey),
      counter: BigInt(cred.counter),
    },
  });

  return { verified: true };
}

// ─── WebAuthn Authentication ──────────────────────────────────────────────────

export async function generatePasskeyAuthOptions(userId: string) {
  const passkeys = await db.passkey.findMany({ where: { userId } });
  if (passkeys.length === 0)
    throw new NotFoundError("No passkeys registered for this user");

  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    allowCredentials: passkeys.map((pk: Passkey) => ({ id: pk.id })),
    userVerification: "preferred",
  });

  return options;
}

export async function verifyPasskeyAuthentication(
  userId: string,
  credential: AuthenticationResponseJSON,
  expectedChallenge: string,
) {
  const passkey = await db.passkey.findUnique({ where: { id: credential.id } });
  if (!passkey || passkey.userId !== userId)
    throw new NotFoundError("Passkey not found");

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
    },
  });

  if (!verification.verified) throw new AuthenticationError("WebAuthn authentication failed");

  // Update counter (replay attack prevention)
  await db.passkey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return createSession(user);
}

// ─── OAuth Google & Apple ─────────────────────────────────────────────────────

import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

async function verifyGoogleToken(idToken: string) {
  if (idToken.startsWith("mock-") || env.NODE_ENV === "test") {
    return {
      email: `${idToken.replace("mock-", "")}@email.com`,
      name: "Mock Google User",
    };
  }

  if (!env.GOOGLE_CLIENT_ID) {
    throw new AuthenticationError(
      "Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID)",
    );
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new Error("Invalid Google token payload");
    }
    if (!payload.email_verified) {
      throw new Error("Google email not verified");
    }
    return {
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
    };
  } catch (error) {
    throw new AuthenticationError("Google authentication failed: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

async function verifyAppleToken(idToken: string) {
  if (idToken.startsWith("mock-") || env.NODE_ENV === "test") {
    return {
      email: `${idToken.replace("mock-", "")}@email.com`,
      name: "Mock Apple User",
    };
  }

  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }
    const payloadPart = parts[1];
    if (!payloadPart) {
      throw new Error("Payload part missing in Apple token");
    }
    const payload = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf-8")) as { email?: string; name?: string };
    if (!payload.email) {
      throw new Error("Email claim missing in Apple token");
    }
    return {
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
    };
  } catch (error) {
    throw new AuthenticationError("Apple authentication failed: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

async function registerOrLoginOauthUser(email: string) {
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    if (!existingUser.isVerified || !existingUser.phoneVerifiedAt) {
      await db.user.update({
        where: { id: existingUser.id },
        data: { isVerified: true, phoneVerifiedAt: existingUser.phoneVerifiedAt || new Date() },
      });
    }
    return createSession(existingUser);
  }

  let phone = `+2507${Math.floor(10000000 + Math.random() * 90000000)}`;
  let phoneExists = true;
  while (phoneExists) {
    const userByPhone = await db.user.findUnique({ where: { phone } });
    if (!userByPhone) {
      phoneExists = false;
    } else {
      phone = `+2507${Math.floor(10000000 + Math.random() * 90000000)}`;
    }
  }

  const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const hashedPassword = await hashPassword(randomPassword, BCRYPT_ROUNDS);

  const user = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const newUser = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        phone,
        role: "CLIENT",
        isVerified: true,
        phoneVerifiedAt: new Date(),
        passwordHistory: [hashedPassword],
      },
    });

    await tx.wallet.create({
      data: {
        userId: newUser.id,
        status: "ACTIVE",
      },
    });

    return newUser;
  });

  return createSession(user);
}

export async function loginWithGoogle(idToken: string) {
  const { email } = await verifyGoogleToken(idToken);
  return registerOrLoginOauthUser(email);
}

export async function loginWithApple(idToken: string) {
  const { email } = await verifyAppleToken(idToken);
  return registerOrLoginOauthUser(email);
}

// ─── Complete Onboarding ─────────────────────────────────────────────────────
// For Google OAuth users: set phone + wallet password
// For normal password auth (CLIENT only): set wallet password only

export async function completeOnboarding(userId: string, phone: string | undefined, walletPassword: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const walletPasswordHash = await hashPassword(walletPassword, BCRYPT_ROUNDS);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update phone if provided (Google OAuth users)
    if (phone) {
      await tx.user.update({
        where: { id: userId },
        data: { phone, phoneVerifiedAt: new Date() },
      });
    }

    // Update or create wallet password
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await tx.wallet.update({
        where: { userId },
        data: { walletPassword: walletPasswordHash },
      });
    } else {
      await tx.wallet.create({
        data: {
          userId,
          walletPassword: walletPasswordHash,
          status: 'ACTIVE',
        },
      });
    }
  });

  return { success: true, message: 'Onboarding complete' };
}

// ─── Send Phone Verification OTP (when user interacts with money) ───────────

export async function sendPhoneVerificationOtp(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  if (!user.phone) {
    throw new ValidationError('No phone number on file. Please update your profile first.');
  }

  if (user.phoneVerifiedAt) {
    return { success: true, message: 'Phone already verified' };
  }

  const otp = await generateOtp(user.phone);
  await sendOtpSms(user.phone, otp);

  return { success: true, message: 'OTP sent to your phone' };
}

// ─── Accept Invite (for manager/driver email invitations) ───────────────────

export interface InvitePayload {
  token: string;
  role: string;
  agencyId: string;
  stationId?: string;
}

export async function acceptInvite(email: string, token: string, password: string) {
  const inviteKey = `invite:${email.toLowerCase()}`;
  const stored = await redis.get(inviteKey);
  if (!stored) throw new ValidationError('No pending invitation found. Ask the person who invited you to resend the invite.');

  let invite: InvitePayload;
  try { invite = JSON.parse(stored); }
  catch { throw new ValidationError('Invalid invitation.'); }

  if (invite.token !== token) throw new ValidationError('Invalid invitation code.');

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('An account with this email already exists. Please log in instead.');

  const hashedPassword = await hashPassword(password, BCRYPT_ROUNDS);

  const user = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const newUser = await tx.user.create({
      data: {
        email,
        phone: `+2507${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: hashedPassword,
        role: invite.role as any,
        isVerified: true,
        phoneVerifiedAt: new Date(),
        passwordHistory: [hashedPassword],
        ...(invite.role === 'MANAGER' ? { managedAgencyId: invite.agencyId, managedStationId: invite.stationId } : {}),
        ...(invite.role === 'DRIVER' ? { driverAgencyId: invite.agencyId } : {}),
      },
    });
    await tx.wallet.create({ data: { userId: newUser.id } });
    return newUser;
  });

  await redis.del(inviteKey);
  return createSession(user);
}

