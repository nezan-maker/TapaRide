import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import { env } from "../src/config/env.js";
import { authenticate } from "../src/plugins/rbac.js";
import { db } from "../src/lib/db.js";

test("authenticate blocks expired passwords before protected handlers run", async (t) => {
  const token = jwt.sign({ id: "user-1", role: "PASSENGER" }, env.JWT_SECRET, {
    expiresIn: "15m",
  });
  const originalFindUnique = db.user.findUnique.bind(db.user);
  let findUniqueCalls = 0;
  db.user.findUnique = (async () => {
    findUniqueCalls += 1;
    return {
      lastPasswordChangedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    };
  }) as typeof db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique as typeof db.user.findUnique;
  });

  const req = {
    headers: { authorization: `Bearer ${token}` },
    path: "/api/tickets",
  };
  const body: Record<string, unknown> = {};
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      Object.assign(body, payload);
      return this;
    },
  };
  let nextCalls = 0;

  await authenticate(req as any, res as any, () => {
    nextCalls += 1;
  });

  assert.equal(findUniqueCalls, 1);
  assert.equal(nextCalls, 0);
  assert.equal(res.statusCode, 403);
  assert.equal(body["code"], "PASSWORD_EXPIRED");
});
