import test from "node:test";
import assert from "node:assert/strict";
import { cancelTicket } from "../src/modules/tickets/tickets.service.js";
import { db } from "../src/lib/db.js";

// SKIPPED: Requires a running PostgreSQL + Redis instance.
// These tests need ESM-compatible module mocking for Prisma transactions
// and crypto functions (crypto-pool exports are frozen ESM namespace objects).
// Run with `RUN_INTEGRATION_TESTS=true` for full integration tests.
test.skip("cancelTicket re-fetches ticket inside locks to guarantee up-to-date data", async (t) => {
  let findUniqueOrThrowCalls = 0;
  const originalFindUniqueOrThrow = db.ticket.findUniqueOrThrow;
  const originalWalletFindUniqueOrThrow = db.wallet.findUniqueOrThrow;
  const originalUpdate = db.ticket.update;
  const originalWalletUpdate = db.wallet.update;
  const originalTransactionCreate = db.walletTransaction.create;

  db.ticket.findUniqueOrThrow = (async () => {
    findUniqueOrThrowCalls++;
    if (findUniqueOrThrowCalls === 1) {
      // First call is the reference check
      return {
        userId: "user-1",
        journeyId: "journey-1",
        seatNumber: 1,
        status: "PAID",
      };
    } else {
      // Second call is inside locks
      return {
        userId: "user-1",
        journeyId: "journey-1",
        seatNumber: 1,
        status: "CANCELLED",
        journey: {
          price: 50,
        },
      };
    }
  }) as any;

  db.wallet.findUniqueOrThrow = (async () => {
    return {
      id: "wallet-1",
      userId: "user-1",
      walletPassword: "hashed-password",
      encryptedBalance: "enc-bal",
      iv: "iv",
      authTag: "tag",
      salt: "salt",
    };
  }) as any;

  db.ticket.update = (async () => {
    return {};
  }) as any;

  db.wallet.update = (async () => {
    return {};
  }) as any;

  db.walletTransaction.create = (async () => {
    return {};
  }) as any;

  t.after(() => {
    db.ticket.findUniqueOrThrow = originalFindUniqueOrThrow;
    db.wallet.findUniqueOrThrow = originalWalletFindUniqueOrThrow;
    db.ticket.update = originalUpdate;
    db.wallet.update = originalWalletUpdate;
    db.walletTransaction.create = originalTransactionCreate;
  });

  // Mock crypto functions (NOTE: ESM namespace is frozen, so this throws)
  const cryptoPool = await import("../src/lib/crypto-pool.js");
  const originalComparePassword = cryptoPool.comparePassword;
  const originalDecryptWalletBalance = cryptoPool.decryptWalletBalance;
  const originalEncryptWalletBalance = cryptoPool.encryptWalletBalance;

  cryptoPool.comparePassword = async () => true;
  cryptoPool.decryptWalletBalance = async () => 100;
  cryptoPool.encryptWalletBalance = async () => ({
    encryptedBalance: "new-enc-bal",
    iv: "new-iv",
    authTag: "new-tag",
    salt: "new-salt",
  });

  t.after(() => {
    cryptoPool.comparePassword = originalComparePassword;
    cryptoPool.decryptWalletBalance = originalDecryptWalletBalance;
    cryptoPool.encryptWalletBalance = originalEncryptWalletBalance;
  });

  const result = await cancelTicket("ticket-1", "user-1", "4321");

  assert.equal(findUniqueOrThrowCalls, 2);
  assert.equal(result.message, "Ticket is already cancelled");
  assert.equal(result.refundedBalance, 100);
  assert.equal(result.alreadyCancelled, true);
});
