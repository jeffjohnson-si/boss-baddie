-- ===========================================================================
-- 002 — PHONE VERIFICATION FOR SIGN-UP
-- ===========================================================================
-- A new account used to be created the moment the form was submitted. Now the
-- number has to be proven first: we text a six-digit code, and the account is only
-- written when that code comes back.
--
-- WHY A SEPARATE TABLE rather than a flag on `customers`:
--   - Nothing half-made ever reaches the customer table, so a login cannot land on
--     an unverified account and an abandoned sign-up does not hold a phone number
--     hostage.
--   - The row carries everything the sign-up collected (including the already
--     hashed password), so verification finishes the job without asking again.
--   - It expires and can be deleted without touching a real account.
--
-- The code itself is never stored: `code_hash` is an HMAC of phone + code, keyed
-- with CUSTOMER_SESSION_SECRET (see lib/verification.js).
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS signup_verifications (
  -- One pending sign-up per number. Re-submitting the form replaces it.
  phone         TEXT PRIMARY KEY CHECK (phone ~ '^[0-9]{6,15}$'),

  code_hash     TEXT NOT NULL,

  -- What the form collected. The password is a scrypt hash, never the password.
  name          TEXT NOT NULL,
  location      TEXT,
  email         TEXT,
  password_hash TEXT NOT NULL,

  -- Wrong guesses. Five and the pending row is deleted, so a code cannot be
  -- brute-forced even though it is only six digits.
  attempts      INTEGER NOT NULL DEFAULT 0,

  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

-- Lets a maintenance pass (or a lazy sweep on the next sign-up) find dead rows.
CREATE INDEX IF NOT EXISTS signup_verifications_expires_idx
  ON signup_verifications (expires_at);

COMMIT;
