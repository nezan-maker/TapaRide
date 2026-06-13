CREATE TYPE "IdempotencyState" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "Wallet"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WalletTransaction"
ADD COLUMN "referenceId" TEXT,
ADD COLUMN "idempotencyKeyId" TEXT;

CREATE TABLE "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" "IdempotencyState" NOT NULL DEFAULT 'PROCESSING',
  "statusCode" INTEGER,
  "responseBody" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_userId_route_key_key"
ON "IdempotencyKey"("userId", "route", "key");

CREATE INDEX "IdempotencyKey_createdAt_idx"
ON "IdempotencyKey"("createdAt");

CREATE INDEX "IdempotencyKey_state_createdAt_idx"
ON "IdempotencyKey"("state", "createdAt");

CREATE INDEX "WalletTransaction_idempotencyKeyId_idx"
ON "WalletTransaction"("idempotencyKeyId");

ALTER TABLE "IdempotencyKey"
ADD CONSTRAINT "IdempotencyKey_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction"
ADD CONSTRAINT "WalletTransaction_idempotencyKeyId_fkey"
FOREIGN KEY ("idempotencyKeyId") REFERENCES "IdempotencyKey"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
