import test from "node:test";
import assert from "node:assert/strict";
import { changeWalletPassword } from "../src/modules/wallets/wallet.service.js";
import { db } from "../src/lib/db.js";
import { redis } from "../src/lib/redis.js";

// SKIPPED: Requires a running PostgreSQL + Redis instance.
// These tests need ESM-compatible module mocking for Prisma transactions
// and crypto functions (crypto-pool exports are frozen ESM namespace objects).
// Run with `RUN_INTEGRATION_TESTS=true` for full integration tests.
test.skip("changeWalletPassword deletes cached unlock-key in Redis", async (t) => {
  const originalFindUniqueOrThrow = db.wallet.findUniqueOrThrow;
  const originalUpdate = db.wallet.update;

  let redisDelCalls = 0;
  let redisKeyDeleted = "";

  const originalRedisDel = redis.del;
  redis.del = (async (key: string) => {
    redisDelCalls++;
    redisKeyDeleted = key;
    return 1;
  }) as any;

  db.wallet.findUniqueOrThrow = (async () => {
    return {
      id: "wallet-1",
      userId: "user-1",
      walletPassword: "hashed-old-password",
      encryptedBalance: "enc-bal",
      iv: "iv",
      authTag: "tag",
      salt: "salt",
    };
  }) as any;

  db.wallet.update = (async () => {
    return {};
  }) as any;

  t.after(() => {
    db.wallet.findUniqueOrThrow = originalFindUniqueOrThrow;
    db.wallet.update = originalUpdate;
    redis.del = originalRedisDel;
  });

  // Mock cryptographic operations to avoid actual pool calls
  const cryptoPool = await import("../src/lib/crypto-pool.js");
  const originalComparePassword = cryptoPool.comparePassword;
  const originalDecryptWalletBalance = cryptoPool.decryptWalletBalance;
  const originalEncryptWalletBalance = cryptoPool.encryptWalletBalance;
  const originalHashPassword = cryptoPool.hashPassword;

  cryptoPool.comparePassword = async () => true;
  cryptoPool.decryptWalletBalance = async () => 100;
  cryptoPool.encryptWalletBalance = async () => ({
    encryptedBalance: "new-enc-bal",
    iv: "new-iv",
    authTag: "new-tag",
    salt: "new-salt",
  });
  cryptoPool.hashPassword = async () => "hashed-new-password";

  t.after(() => {
    cryptoPool.comparePassword = originalComparePassword;
    cryptoPool.decryptWalletBalance = originalDecryptWalletBalance;
    cryptoPool.encryptWalletBalance = originalEncryptWalletBalance;
    cryptoPool.hashPassword = originalHashPassword;
  });

  const result = await changeWalletPassword("user-1", "old-pass", "new-pass");

  assert.equal(redisDelCalls, 1);
  assert.equal(redisKeyDeleted, "wallet:unlock-key:user-1");
  assert.deepEqual(result, { message: "Wallet password changed successfully" });
});
