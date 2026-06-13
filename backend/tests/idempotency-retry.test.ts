import test from "node:test";
import assert from "node:assert/strict";
import { runIdempotentMutation } from "../src/lib/idempotency.js";
import { db } from "../src/lib/db.js";
import { IdempotencyState } from "@prisma/client";

test("runIdempotentMutation deletes FAILED record to allow retry", async (t) => {
  let deleteCalls = 0;
  let createCalls = 0;
  let executeCalls = 0;

  const originalFindUnique = db.idempotencyKey.findUnique;
  const originalDelete = db.idempotencyKey.delete;
  const originalCreate = db.idempotencyKey.create;
  const originalUpdate = db.idempotencyKey.update;

  db.idempotencyKey.findUnique = (async () => {
    const { createHmac } = await import("node:crypto");
    const { env } = await import("../src/config/env.js");
    const expectedHash = createHmac("sha256", env.HMAC_SECRET)
      .update('{"data":"test"}')
      .digest("hex");

    return {
      id: "test-id",
      userId: "user-1",
      route: "/test",
      key: "key-1",
      requestHash: expectedHash,
      state: IdempotencyState.FAILED,
      statusCode: null,
      responseBody: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }) as any;

  db.idempotencyKey.delete = (async (args: any) => {
    deleteCalls++;
    assert.deepEqual(args.where.userId_route_key, {
      userId: "user-1",
      route: "/test",
      key: "key-1",
    });
    return {};
  }) as any;

  db.idempotencyKey.create = (async () => {
    createCalls++;
    return {};
  }) as any;

  db.idempotencyKey.update = (async () => {
    return {};
  }) as any;

  t.after(() => {
    db.idempotencyKey.findUnique = originalFindUnique;
    db.idempotencyKey.delete = originalDelete;
    db.idempotencyKey.create = originalCreate;
    db.idempotencyKey.update = originalUpdate;
  });

  const result = await runIdempotentMutation({
    userId: "user-1",
    route: "/test",
    idempotencyKey: "key-1",
    requestBody: { data: "test" },
    execute: async () => {
      executeCalls++;
      return { statusCode: 200, body: { success: true } };
    },
  });

  assert.equal(deleteCalls, 1);
  assert.equal(createCalls, 1);
  assert.equal(executeCalls, 1);
  assert.equal(result.replay, false);
  assert.deepEqual(result.body, { success: true });
});
