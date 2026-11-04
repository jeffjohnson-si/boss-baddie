-- ===========================================================================
-- 011 — EMAIL ACCOUNTS
-- ===========================================================================
-- Customers prove who they are by email now, not by a texted code. The phone
-- number stays on the account as contact information — Patricia still needs to
-- reach people about collections — but it is no longer the login handle, so it
-- is no longer unique (two people in one household may share a number).
--
-- Pending codes are keyed by email. They live for ten minutes and carry no
-- customer data, so dropping the old rows is cheaper and clearer than rekeying
-- a table whose primary key is the phone number.
-- ===========================================================================

BEGIN;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_phone_key;

-- Email is the handle, so one address may only have one account, whatever case
-- she types it in. Partial: rows that predate this migration have no email.
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
  ON customers (lower(email))
  WHERE email IS NOT NULL;

DROP TABLE IF EXISTS signup_verifications;
CREATE TABLE signup_verifications (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT,
  location   TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS signup_verifications_expires_idx
  ON signup_verifications (expires_at);

DROP TABLE IF EXISTS customer_login_codes;
CREATE TABLE customer_login_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_login_codes_expires_idx
  ON customer_login_codes (expires_at);

COMMIT;
