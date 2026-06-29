-- Sync missing Agency columns found in schema.prisma

ALTER TABLE "Agency"
  ADD COLUMN IF NOT EXISTS "ruraCode" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

-- Prisma schema has @@unique([ruraCode]) which maps to a UNIQUE index.
-- UNIQUE allows multiple NULLs, matching optional semantics.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Agency_ruraCode_key'
  ) THEN
    CREATE UNIQUE INDEX "Agency_ruraCode_key" ON "Agency" ("ruraCode");
  END IF;
END
$$;

