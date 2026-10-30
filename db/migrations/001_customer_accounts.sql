-- ===========================================================================
-- 001 — CUSTOMER ACCOUNTS
-- ===========================================================================
-- Before this, a shop customer had no account at all: the invoice token was the
-- whole authorisation and the only "list" of her orders was the one her browser
-- kept (lib/my-invoices.js). That is fine for a visitor, and still works for one
-- off, but it cannot survive a new phone.
--
-- AN ACCOUNT IS NOW REQUIRED TO ORDER. That is a deliberate change of policy, and
-- it is what makes "my orders and invoices, on any device" possible: every order
-- carries the id of the customer who placed it, so the account page can read them
-- from Postgres instead of guessing from a browser's memory.
--
-- WHY PHONE AND NOT EMAIL: Patricia's customers reach her on WhatsApp and mostly
-- have no email address — the checkout form has always let them leave it blank.
-- So the phone number is the login handle: digits only, country code optional and
-- stripped on save (see normalisePhone() in lib/customers.js). It is UNIQUE, so
-- one number is one account.
--
-- Passwords are scrypt hashes (lib/customer-auth.js, the same format the community
-- uses). The plain password is never stored, logged, or sent anywhere.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  -- TEXT, not UUID: the app generates prefixed ids ('cus_<uuid>').
  id            TEXT PRIMARY KEY,

  -- Digits only, e.g. '7400000'. The login handle. A number, not an email, so
  -- there is nothing to verify by link and no address to keep in sync.
  phone         TEXT NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{6,15}$'),

  name          TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),

  -- Village / suburb / province. Optional on the account, but prefilled into
  -- checkout, which does require it on the order itself.
  location      TEXT,
  -- Contact-only. Never a login handle, so duplicate addresses are not a problem
  -- and there is nothing to verify.
  email         TEXT,

  -- scrypt$<saltHex>$<hashHex> — see lib/community-auth.js for the format.
  password_hash TEXT NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC);

-- Orders now belong to an account. ON DELETE SET NULL rather than CASCADE: a
-- deleted account must never delete what was actually sold. The order keeps its
-- own snapshot of the name, phone and location, so it stays readable and
-- printable after the account is gone.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT
  REFERENCES customers (id) ON DELETE SET NULL;

-- The account page reads newest-first for one customer, which is exactly this.
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC);

COMMIT;
