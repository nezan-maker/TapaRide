import test, { after } from "node:test";
import assert from "node:assert/strict";

import { redis } from "../src/lib/redis.js";
import { getCandidateStopIds } from "../src/modules/waitlist/waitlist.utils.js";

after(() => {
  redis.disconnect();
});

test("getCandidateStopIds returns current and subsequent stops in journey order", () => {
  const stops = [
    { stationId: "stop-a", order: 1 },
    { stationId: "stop-b", order: 2 },
    { stationId: "stop-c", order: 3 },
  ];

  assert.deepEqual(getCandidateStopIds(stops, "stop-b"), [
    "stop-b",
    "stop-c",
  ]);
});

test("getCandidateStopIds falls back to current stop when it is missing from the journey definition", () => {
  const stops = [
    { stationId: "stop-a", order: 1 },
    { stationId: "stop-b", order: 2 },
  ];

  assert.deepEqual(getCandidateStopIds(stops, "stop-x"), ["stop-x"]);
});
