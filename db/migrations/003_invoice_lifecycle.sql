-- ===========================================================================
-- 003 — INVOICE LIFECYCLE
-- ===========================================================================
-- Until now an invoice appeared the moment Patricia saved a collection place or
-- time: "arranged" and "issued" were the same act. They are not the same thing.
-- She wants to review an order first, then issue the invoice deliberately, and be
-- able to move it on afterwards (paid, or void if the order falls through).
--
-- So an order now carries its own `invoice_status`:
--
--   pending  — the order has been submitted; no invoice yet. The customer's link
--              says "being prepared". This is the default, because a new order is
--              a request, not a bill.
--   issued   — Patricia has reviewed it and issued the invoice. The customer sees
--              the printable document with the amount due on collection.
--   paid     — cash has been received. The invoice still prints, marked paid.
--   void     — the order was cancelled; the link explains that instead of billing.
--
-- `invoice_issued_at` records when it was issued, which is what the dashboard and
-- the customer's list show. Existing orders that already had collection details
-- are backfilled as issued: they were, in effect, issued under the old rule.
-- ===========================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('pending', 'issued', 'paid', 'void');
  END IF;
END
$$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_status invoice_status NOT NULL DEFAULT 'pending';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ;

-- Backfill: anything with collection details arranged was already visible to the
-- customer, so it is treated as issued rather than demoted to pending.
UPDATE orders
   SET invoice_status = 'issued',
       invoice_issued_at = COALESCE(invoice_issued_at, updated_at, created_at)
 WHERE invoice_status = 'pending'
   AND (pickup_place <> '' OR pickup_when <> '');

CREATE INDEX IF NOT EXISTS orders_invoice_status_idx ON orders (invoice_status);

COMMIT;
