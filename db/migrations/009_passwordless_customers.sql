-- ===========================================================================
-- 009 — PASSWORDLESS CUSTOMER LOGIN
-- ===========================================================================
-- Customers now sign in with their phone number and a texted six-digit code.
-- There is no customer password to store, reset or change.
--
-- customer_login_codes is separate from signup_verifications: one proves a new
-- sign-up, the other signs an existing account in, and they have different
-- lifetimes and cleanup rules.
--
-- password_hash columns are left in place but made nullable, so existing rows
-- stay readable and the schema does not need a destructive rewrite.
-- ===========================================================================

BEGIN;

ALTER TABLE customers
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE signup_verifications
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS customer_login_codes (
  phone      TEXT PRIMARY KEY CHECK (phone ~ '^[0-9]{6,15}$'),
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_login_codes_expires_idx
  ON customer_login_codes (expires_at);

COMMIT;
