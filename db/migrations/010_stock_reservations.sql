-- ===========================================================================
-- 010 — STOCK RESERVATION
-- ===========================================================================
-- Submitting an order now takes its units out of stock, so two customers cannot
-- buy the last case. Cancelling the order, or voiding its invoice, puts them
-- back; moving the order back into the workflow reserves them again.
--
-- stock_released records which side of that line the order is already on, so a
-- transition moves stock exactly once and a repeated click cannot return the
-- same units twice.
-- ===========================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stock_released BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
