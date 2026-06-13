import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync, createHash, createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256-bit key
const IV_LENGTH = 12;  // 96-bit IV recommended for GCM
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 310_000; // NIST recommended minimum
const PBKDF2_DIGEST = 'sha512';

/**
 * Derives a 256-bit AES key from a user's password and a random salt.
 * PBKDF2 with high iterations makes brute-force attacks expensive.
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypts a numeric balance using AES-256-GCM.
 * Each encryption produces a unique IV and auth tag for tamper detection.
 *
 * @param balance       The plaintext balance (e.g. 1500.00)
 * @param passwordOrKey The user's raw password or a pre-derived key Buffer
 * @returns             Encrypted fields to store in the Wallet table
 */
export function encryptBalance(
  balance: number,
  passwordOrKey: string | Buffer,
): { encryptedBalance: string; iv: string; authTag: string; salt: string } {
  let key: Buffer;
  let salt: Buffer;

  if (Buffer.isBuffer(passwordOrKey)) {
    key = passwordOrKey;
    salt = randomBytes(SALT_LENGTH);
  } else {
    salt = randomBytes(SALT_LENGTH);
    key = deriveKey(passwordOrKey, salt);
  }
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = balance.toString();
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBalance: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

/**
 * Decrypts an encrypted balance back to a number.
 * Will throw if the password is wrong or the data has been tampered with.
 *
 * @param encryptedBalance Base64 ciphertext
 * @param iv               Base64 IV
 * @param authTag          Base64 GCM auth tag
 * @param salt             Base64 PBKDF2 salt
 * @param passwordOrKey    The user's raw password or pre-derived key Buffer
 * @returns                The plaintext balance as a number
 */
export function decryptBalance(
  encryptedBalance: string,
  iv: string,
  authTag: string,
  salt: string,
  passwordOrKey: string | Buffer,
): number {
  let key: Buffer;
  if (Buffer.isBuffer(passwordOrKey)) {
    key = passwordOrKey;
  } else {
    const saltBuf = Buffer.from(salt, 'base64');
    key = deriveKey(passwordOrKey, saltBuf);
  }
  const ivBuf = Buffer.from(iv, 'base64');
  const authTagBuf = Buffer.from(authTag, 'base64');
  const ciphertext = Buffer.from(encryptedBalance, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTagBuf);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return parseFloat(decrypted.toString('utf8'));
}

/**
 * Re-encrypts the balance with a fresh IV and salt.
 * Call this every time the balance changes to maintain forward secrecy.
 */
export function reEncryptBalance(
  newBalance: number,
  password: string,
): ReturnType<typeof encryptBalance> {
  return encryptBalance(newBalance, password);
}

// ─── Module 1 & General Security Enhancements ─────────────────────────────────

/**
 * Generates a SHA-256 hash for a given string or object.
 */
export function generateHash(data: string | object): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generates an HMAC-SHA256 signature using the server secret.
 */
export function generateSignature(data: string | object, secret: string): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHmac('sha256', secret).update(content).digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature.
 */
export function verifySignature(data: string | object, signature: string, secret: string): boolean {
  const expected = generateSignature(data, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Encrypts sensitive data (like National ID) for storage in the database.
 * Uses AES-256-GCM with the master DATABASE_ENCRYPTION_KEY.
 */
export function encryptAtRest(plaintext: string): string {
  const key = Buffer.from(env.DATABASE_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts data encrypted with encryptAtRest.
 */
export function decryptAtRest(encryptedData: string): string {
  const [ivBase64, authTagBase64, ciphertextBase64] = encryptedData.split(':');
  if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error('Invalid encrypted data format');
  }

  const key = Buffer.from(env.DATABASE_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

