-- ===========================================================================
-- 007 — ADMIN ACCOUNTS, RECOVERY EMAILS AND PASSWORD RESETS
-- ===========================================================================
-- The original admin login was a single email/password pair in environment
-- variables: no registration, no password reset, no second person. This adds a
-- real account row so Patricia can own her login and recover it by email.
--
-- Sessions carry the admin id and session_version. A password change or reset
-- increments session_version, which invalidates every older cookie without
-- needing a server-side session table.
--
-- Password-reset and recovery-verification tokens are stored as SHA-256 hashes,
-- never as the token itself, and are single-use with an expiry.
-- ===========================================================================

BEGIN;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- One account per email address, case-insensitively.
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_idx
  ON admin_users (lower(email));

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON admin_users;
CREATE TRIGGER admin_users_set_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- admin_recovery_emails — extra addresses that may receive a reset link
-- ---------------------------------------------------------------------------
-- A row only counts after verified_at is set. Adding an address sends a
-- verification link to it; until that link is opened it cannot receive resets.
CREATE TABLE IF NOT EXISTS admin_recovery_emails (
  id                TEXT PRIMARY KEY,                 -- 'are_<uuid>'
  admin_id          UUID NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  verified_at       TIMESTAMPTZ,
  verify_token_hash TEXT,
  verify_expires_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The same recovery address cannot belong to two admins.
CREATE UNIQUE INDEX IF NOT EXISTS admin_recovery_emails_email_idx
  ON admin_recovery_emails (lower(email));

CREATE INDEX IF NOT EXISTS admin_recovery_emails_admin_idx
  ON admin_recovery_emails (admin_id, created_at);

-- ---------------------------------------------------------------------------
-- admin_password_resets — one-time reset links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_password_resets (
  id         TEXT PRIMARY KEY,                        -- 'apr_<uuid>'
  admin_id   UUID NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,                    -- SHA-256 of the emailed token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_password_resets_admin_idx
  ON admin_password_resets (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_password_resets_expires_idx
  ON admin_password_resets (expires_at);

COMMIT;
