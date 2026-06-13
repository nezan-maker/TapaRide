import { randomInt } from "crypto";

import { redis } from "./redis.js";

/**
 * In-memory OTP store.
 * Production: replace with Redis with TTL support.
 */
const OTP_EXPIRES_SECONDS =
  parseInt(process.env["OTP_EXPIRES_MINUTES"] ?? "10", 10) * 60;

function getOtpKey(phone: string) {
  return `otp:phone:${phone}`;
}

/**
 * Generates a 6-digit OTP for the given phone number and stores it.
 * Returns the OTP string (you'd send this via SMS in production).
 */
export async function generateOtp(phone: string): Promise<string> {
  const code = randomInt(100_000, 999_999).toString();
  await redis.set(getOtpKey(phone), code, "EX", OTP_EXPIRES_SECONDS);

  if (process.env["NODE_ENV"] !== "production") {
    // Log OTP in development for easy testing
    console.log(`[OTP DEV] Phone ${phone}: ${code}`);
  }

  return code;
}

/**
 * Verifies an OTP. Returns true if valid, false otherwise.
 * Consumes the OTP on success (one-time use).
 */
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<boolean> {
  const key = getOtpKey(phone);
  const storedCode = await redis.get(key);

  if (!storedCode) {
    return false;
  }
  if (storedCode !== code) return false;

  await redis.del(key); // consume — one-time use
  return true;
}
