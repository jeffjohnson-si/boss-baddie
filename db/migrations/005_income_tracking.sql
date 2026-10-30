-- ===========================================================================
-- 005 — INCOME TRACKING
-- ===========================================================================
-- Patricia needs to know what came in this week, this month and this year. That
-- needs a date the money arrived, and until now there was none: an invoice could be
-- marked paid, but nothing recorded WHEN.
--
--   paid_at  the moment an invoice is marked Paid, stamped once by
--            setInvoiceStatus() in lib/orders.js.
--
-- INCOME = invoice_status 'paid' AND paid_at IS NOT NULL. Deliberately not the
-- order status: an order can be "awaiting_payment" while the cash has already been
-- handed over, and an invoice can be voided after a mistaken "paid". The invoice's
-- own status is the closest thing to a receipt this shop has.
--
-- Existing paid invoices are backfilled from updated_at, which is the last time the
-- row was touched and therefore the best available approximation of when it was
-- marked paid.
-- ===========================================================================

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE orders
   SET paid_at = COALESCE(paid_at, updated_at, created_at)
 WHERE invoice_status = 'paid'
   AND paid_at IS NULL;

-- The dashboard sums by week/month/year over paid rows only.
CREATE INDEX IF NOT EXISTS orders_paid_at_idx
  ON orders (paid_at DESC)
  WHERE invoice_status = 'paid';

COMMIT;
