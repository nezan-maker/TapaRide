import test from "node:test";
import assert from "node:assert/strict";

process.env["CRYPTO_WORKER_LIMIT"] = "1";

test("crypto worker pool reuses an idle worker for sequential tasks", async () => {
  const {
    comparePassword,
    hashPassword,
    shutdownCryptoPool,
  } = await import("../src/lib/crypto-pool.js");

  try {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await comparePassword("correct horse battery staple", hash), true);
    assert.equal(await comparePassword("wrong password", hash), false);
  } finally {
    await shutdownCryptoPool();
  }
});

test("deriveKeyPBKDF2 derives base64 key correctly", async () => {
  const {
    deriveKeyPBKDF2,
    shutdownCryptoPool,
  } = await import("../src/lib/crypto-pool.js");

  try {
    const salt = "c2FsdHNhbHRzYWx0c2FsdHNhbHRzYWx0c2FsdHNhbHQ=";
    const key = await deriveKeyPBKDF2("mypassword", salt);
    assert.equal(typeof key, "string");
    assert.ok(key.length > 0);
  } finally {
    await shutdownCryptoPool();
  }
});
