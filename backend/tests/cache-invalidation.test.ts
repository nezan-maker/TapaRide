import test, { after } from "node:test";
import assert from "node:assert/strict";

import { redis } from "../src/lib/redis.js";
import { getCacheTagsForDomainEvent } from "../src/lib/cache-invalidation.js";

after(() => {
  redis.disconnect();
});

test("ticket events invalidate journey, ticket history, and wallet transaction tags", () => {
  const tags = getCacheTagsForDomainEvent({
    name: "ticket.created",
    payload: {
      journeyId: "journey-1",
      userId: "user-1",
    },
  });

  assert.deepEqual(tags, [
    "journeys",
    "journey:journey-1",
    "user:user-1:tickets",
    "user:user-1:wallet-transactions",
  ]);
});

test("agency manager assignment invalidates agency, station, and user tags", () => {
  const tags = getCacheTagsForDomainEvent({
    name: "agency.manager-assigned",
    payload: {
      agencyId: "agency-1",
      managerId: "manager-1",
      stationId: "station-1",
    },
  });

  assert.deepEqual(tags, [
    "agencies",
    "agency:agency-1",
    "agency:agency-1:stations",
    "station:station-1",
    "user:manager-1",
  ]);
});
