-- ===========================================================================
-- 008 — CUSTOMER SESSION VERSION
-- ===========================================================================
-- Customer cookies used to be valid until their 400-day expiry even after a
-- password change. This adds the same session-version check the admin account
-- uses: a password change or an admin-issued temporary password increments the
-- value, and every older cookie fails at its next request.
-- ===========================================================================

BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
