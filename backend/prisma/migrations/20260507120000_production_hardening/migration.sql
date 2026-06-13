ALTER TABLE "User"
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_isVerified_phoneVerifiedAt_role_idx"
ON "User"("isVerified", "phoneVerifiedAt", "role");

DROP INDEX IF EXISTS "Ticket_journeyId_seatNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_paid_seat_per_journey_key"
ON "Ticket"("journeyId", "seatNumber")
WHERE "status" = 'PAID';

CREATE INDEX IF NOT EXISTS "Ticket_journeyId_seatNumber_status_idx"
ON "Ticket"("journeyId", "seatNumber", "status");

CREATE INDEX IF NOT EXISTS "WaitlistEntry_userId_journeyId_boardingStopId_status_idx"
ON "WaitlistEntry"("userId", "journeyId", "boardingStopId", "status");
