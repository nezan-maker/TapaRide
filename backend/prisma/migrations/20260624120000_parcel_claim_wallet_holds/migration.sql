-- ============================================================================
-- parcel_claim_wallet_holds
--
-- Phase P1 of the parcel receive-flow + wallet-as-source-of-truth migration.
--
-- Why this exists:
--   1. Today parcels are created with `fee = round(weight × 2000)` and the
--      wallet is never debited. The intent in this project is Model 1
--      (wallet as source of truth): sender's wallet funds the parcel send,
--      with a hold→commit lifecycle tied to a journal row. Stripe is the
--      only money-handling primitive, used as the funding rail via the
--      wallet top-up flow. Stripe Connect (agency payouts) is deferred.
--   2. Receivers are not required to be Tapa users. We surface a
--      human-typable `claimKey` (12 chars), distinct from the existing
--      UUID `trackingCode`, that gets SMS'd to the receiver on payment
--      and is the sole proof of "this phone matches that parcel."
--   3. To support the hold→commit lifecycle on the wallet without
--      forcing a full money-processor rewrite, we extend the existing
--      AES-256-GCM-encrypted Wallet to also carry an encrypted
--      heldBalance, and extend the journal (WalletTransaction) with a
--      status / direction / stripeEventId / commit-time triplet.
--
-- This migration is purely additive: nothing existing is renamed or
-- altered in shape. Backwards compatible with current production rows.
-- ============================================================================

-- ─── 1. Enums ──────────────────────────────────────────────────────────────

-- ParcelStatus gains AWAITING_PAYMENT, CONFIRMED, CLAIMED, CANCELLED,
-- EXPIRED. Old states (PENDING, IN_TRANSIT, DELIVERED) preserved.

-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block. Postgres
-- 12+ supports IF NOT EXISTS so we use it.

ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'CLAIMED';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- WalletTransaction state machine: PENDING → COMMITTED | RELEASED, with
-- REVERSED as a post-commit undo state.
CREATE TYPE "TransactionStatus" AS ENUM (
  'PENDING',
  'COMMITTED',
  'RELEASED',
  'REVERSED'
);

-- Direction is required and explicit (redundant with sign of amount).
CREATE TYPE "TransactionDirection" AS ENUM (
  'CREDIT',
  'DEBIT'
);

-- Extend TransactionType with granular sentinels used by the parcel flow
-- and the future ticket-wallet flow. Legacy values preserved.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TOPUP';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TICKET_PURCHASE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TICKET_REFUND';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PARCEL_SEND';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PARCEL_SEND_REFUND';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- ─── 2. Wallet — encrypted heldBalance ────────────────────────────────────

ALTER TABLE "Wallet"
  ADD COLUMN IF NOT EXISTS "encryptedHeldBalance" TEXT,
  ADD COLUMN IF NOT EXISTS "heldBalanceIv"        TEXT,
  ADD COLUMN IF NOT EXISTS "heldBalanceAuthTag"   TEXT;

-- Sanity: new columns are nullable, so existing rows are unaffected.

-- ─── 3. WalletTransaction — lifecycle columns ─────────────────────────────

ALTER TABLE "WalletTransaction"
  ADD COLUMN IF NOT EXISTS "status"       "TransactionStatus"    NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "direction"    "TransactionDirection" NOT NULL DEFAULT 'DEBIT',
  ADD COLUMN IF NOT EXISTS "stripeEventId" TEXT                    UNIQUE,
  ADD COLUMN IF NOT EXISTS "committedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "releasedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reversedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadata"     JSONB;

-- Existing rows are all `DEBIT` by convention (they're money moving out
-- of the wallet into another ledger row / future-paid system), so the
-- default is correct. Status defaults to PENDING so a reconciliation
-- migration or a future endpoint can decide what to do with legacy rows.
--
-- Add the new indexes aligned with the application queries:
--   - (walletId, status)  : state-machine lookups
--   - (referenceId)       : joins to Parcel.id / Ticket.id / Stripe ID
--   - (walletId, createdAt): history pagination

CREATE INDEX IF NOT EXISTS "WalletTransaction_walletId_status_idx"
  ON "WalletTransaction" ("walletId", "status");

CREATE INDEX IF NOT EXISTS "WalletTransaction_referenceId_idx"
  ON "WalletTransaction" ("referenceId");

CREATE INDEX IF NOT EXISTS "WalletTransaction_walletId_createdAt_idx"
  ON "WalletTransaction" ("walletId", "createdAt");

-- ─── 4. Parcel — claim flow + pricing fields ──────────────────────────────

ALTER TABLE "Parcel"
  ADD COLUMN IF NOT EXISTS "claimKey"           TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "pricingStrategy"    TEXT,
  ADD COLUMN IF NOT EXISTS "basePrice"          INTEGER,
  ADD COLUMN IF NOT EXISTS "weightBand"         TEXT,
  ADD COLUMN IF NOT EXISTS "weightMultiplier"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "paymentIntentId"    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "paidAt"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedById"        TEXT,
  ADD COLUMN IF NOT EXISTS "claimedByPhoneHash" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt"          TIMESTAMP(3);

-- Lookups the receive-flow needs:
--   - by status (sweep jobs + dashboards)
--   - by (senderId, status) (sender's getUserParcels query)
--   - by receiverPhone (the URL the receiver sees)
--   - by expiresAt (TTL sweep job)
--
-- Note: existing `Parcel.receiverPhone` already has no index. The
-- receive flow lookups it; we add that index in this migration too,
-- alongside the receiver-flow work.

CREATE INDEX IF NOT EXISTS "Parcel_status_idx"
  ON "Parcel" ("status");

CREATE INDEX IF NOT EXISTS "Parcel_senderId_status_idx"
  ON "Parcel" ("senderId", "status");

CREATE INDEX IF NOT EXISTS "Parcel_receiverPhone_idx"
  ON "Parcel" ("receiverPhone");

CREATE INDEX IF NOT EXISTS "Parcel_expiresAt_idx"
  ON "Parcel" ("expiresAt");
