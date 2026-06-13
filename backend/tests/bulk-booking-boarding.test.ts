import test from "node:test";
import assert from "node:assert/strict";
import { validateBoarding } from "../src/modules/bulk-bookings/bulk-bookings.service.js";
import { db } from "../src/lib/db.js";
import { BoardingStatus } from "@prisma/client";

test("validateBoarding returns success: true and message if passenger already boarded", async (t) => {
  const originalFindUnique = db.bulkPassenger.findUnique;
  const originalUpdate = db.bulkPassenger.update;

  db.bulkPassenger.findUnique = (async () => {
    return {
      id: "passenger-1",
      name: "Sarah Doe",
      status: BoardingStatus.BOARDED,
      bulkBooking: {
        journeyId: "journey-1",
      },
    };
  }) as any;

  t.after(() => {
    db.bulkPassenger.findUnique = originalFindUnique;
    db.bulkPassenger.update = originalUpdate;
  });

  const result = await validateBoarding(
    { id: "driver-1", role: "DRIVER" },
    { type: "PASSENGER", boardingHash: "hash-1" }
  );

  assert.deepEqual(result, {
    success: true,
    message: "Passenger Sarah Doe already boarded",
  });
});

test("validateBoarding throws validation error if passenger already alighted", async (t) => {
  const originalFindUnique = db.bulkPassenger.findUnique;

  db.bulkPassenger.findUnique = (async () => {
    return {
      id: "passenger-1",
      name: "Sarah Doe",
      status: BoardingStatus.ALIGHTED,
      bulkBooking: {
        journeyId: "journey-1",
      },
    };
  }) as any;

  t.after(() => {
    db.bulkPassenger.findUnique = originalFindUnique;
  });

  await assert.rejects(
    validateBoarding(
      { id: "driver-1", role: "DRIVER" },
      { type: "PASSENGER", boardingHash: "hash-1" }
    ),
    {
      name: "ValidationError",
      message: "Passenger Sarah Doe has already alighted",
    }
  );
});
