-- This migration syncs the migration history with the current Prisma schema.
-- It is written to be idempotent (safe to apply to an already-updated DB),
-- because many local/dev databases may already contain some of these changes.

-- ── Enums ───────────────────────────────────────────────────────────────────

-- TicketStatus: add COMPLETED (if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStatus') AND
     NOT EXISTS (
       SELECT 1
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       WHERE t.typname = 'TicketStatus' AND e.enumlabel = 'COMPLETED'
     )
  THEN
    ALTER TYPE "TicketStatus" ADD VALUE 'COMPLETED';
  END IF;
END
$$;

-- WalletStatus: create (if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletStatus') THEN
    CREATE TYPE "WalletStatus" AS ENUM ('UNINITIALIZED', 'ACTIVE');
  END IF;
END
$$;

-- ── Table changes ───────────────────────────────────────────────────────────

-- Vehicle: amenities + seatLayout
ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "seatLayout" JSONB;

-- Parcel: weight + fee
ALTER TABLE "Parcel"
  ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fee" INTEGER;

-- Wallet: status
ALTER TABLE "Wallet"
  ADD COLUMN IF NOT EXISTS "status" "WalletStatus" NOT NULL DEFAULT 'UNINITIALIZED';

-- ── AI conversational memory (Phase 2) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AiConversation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiConversation_userId_idx" ON "AiConversation" ("userId");

CREATE TABLE IF NOT EXISTS "AiMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "toolCalls" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_idx" ON "AiMessage" ("conversationId");

-- Add FK with cascade if missing. (Name is fixed to avoid duplicates.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AiMessage_conversationId_fkey'
  )
  THEN
    ALTER TABLE "AiMessage"
      ADD CONSTRAINT "AiMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

