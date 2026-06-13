-- Store monetary values as integer smallest currency units.
-- Existing values are rounded to preserve deployability if legacy float rows exist.
ALTER TABLE "Journey"
  ALTER COLUMN "price" TYPE INTEGER USING round("price")::integer;

ALTER TABLE "WalletTransaction"
  ALTER COLUMN "amount" TYPE INTEGER USING round("amount")::integer;

ALTER TABLE "Journey"
  ADD CONSTRAINT "Journey_price_positive_check" CHECK ("price" > 0);

ALTER TABLE "WalletTransaction"
  ADD CONSTRAINT "WalletTransaction_amount_positive_check" CHECK ("amount" > 0);
