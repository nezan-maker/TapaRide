// src/lib/crypto.worker.ts
// ---------------------------------------------------------------
//  Worker thread that performs heavy crypto operations.
// ---------------------------------------------------------------
import { parentPort } from 'worker_threads';
import * as argon2 from 'argon2';
import { encryptBalance, decryptBalance } from './crypto.js';

if (!parentPort) {
  throw new Error('crypto.worker must be run as a worker thread');
}

parentPort.on(
  'message',
  async (msg: { id: string; type: string; payload: any }) => {
    const { id, type, payload } = msg;
    try {
      let result: any;
      switch (type) {
        case 'ARGON2_HASH':
          // Argon2id replaces bcrypt — argon2.hash outputs an encoded string
          // containing salt + params, so verification needs no separate salt
          result = await argon2.hash(payload.password, {
            type: argon2.argon2id,
            memoryCost: 8192,   // 8 MB — dev-friendly
            timeCost: 2,        // 2 iterations
            parallelism: 1,
          });
          break;
        case 'ARGON2_COMPARE':
          // Verify against argon2 encoded hash (or legacy bcrypt hash during transition)
          if (payload.hash.startsWith('$2')) {
            // Legacy bcrypt hash — reject, password must be re-hashed on login
            result = false;
          } else {
            result = await argon2.verify(payload.hash, payload.password);
          }
          break;
        case 'ENCRYPT_BALANCE':
          result = encryptBalance(payload.balance, payload.passwordOrKey);
          break;
        case 'DECRYPT_BALANCE':
          result = decryptBalance(
            payload.encryptedBalance,
            payload.iv,
            payload.authTag,
            payload.salt,
            payload.passwordOrKey,
          );
          break;
        case 'PBKDF2_DERIVE':
          // Use actual PBKDF2-SHA512 to match crypto.ts deriveKey().
          // The encryption path uses pbkdf2Sync, so the cached unlock key
          // must use the same derivation — NOT argon2id raw, which produces
          // a completely different key (critical bug fix).
          {
            const { pbkdf2Sync } = await import('crypto');
            const saltBuf = Buffer.from(payload.saltBase64, 'base64');
            const iterations = payload.iterations ?? 310_000;
            const keylen = payload.keylen ?? 32;
            const digest = payload.digest ?? 'sha512';
            result = pbkdf2Sync(payload.password, saltBuf, iterations, keylen, digest);
          }
          break;
        default:
          throw new Error(`Unknown crypto worker task type: ${type}`);
      }
      parentPort!.postMessage({ id, result });
    } catch (e: any) {
      parentPort!.postMessage({ id, error: e?.message ?? String(e) });
    }
  },
);
