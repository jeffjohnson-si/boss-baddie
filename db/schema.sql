-- ===========================================================================
-- BOSS BADDIE — PostgreSQL schema
-- ===========================================================================
-- PostgreSQL is the only database. Orders, products, customers, sign-up
-- verification and the community chat all live here; there is no JSON store to
-- port and no ORDER_STORE switch.
--
-- Apply with `npm run db:migrate`: this file first, then every pending file in
-- db/migrations in filename order. Every statement here is idempotent.
--
-- IDS: every primary key here is TEXT, because the app generates prefixed ids
-- ('ord_<uuid>', 'mem_<uuid>', 'msg_<uuid>') rather than bare UUIDs. Do not
-- "tidy" these into UUID columns — every insert would fail.
--
-- Design notes
-- ------------
-- * There is NO payments table and NO card/token column anywhere. The brand
--   rule is that money is settled in cash, in person, when the order is
--   collected, so the database must never be able to hold cardholder or bank
--   details. Do not add one.
-- * Money is NUMERIC(10,2), never float. Prices are Solomon Islands dollars.
-- * Order lines snapshot the title and unit price at the moment of ordering, so
--   later catalogue edits never rewrite the history of a placed order.
-- * The product catalogue is editable from /admin/products. It lives in the
--   products table below and is read/written by lib/product-store.js.
-- * Products are ARCHIVED first, never deleted in one step (products.archived).
--   Hiding something must be undoable. A permanent delete is a separate, second
--   action and only works on a row that is already archived.
--   order_items.product_id is not a foreign key, so order history survives either.
--
-- Apply with:  npm run db:migrate
-- Safe to re-run: every statement is guarded.
-- ===========================================================================

BEGIN;

-- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums — mirror the constants in lib/order-constants.js exactly.
-- If you add a value there, add it here too (ALTER TYPE ... ADD VALUE).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'new',               -- just submitted, Patricia has not looked yet
      'awaiting_payment',  -- confirmed with the customer, money not received
      'paid',              -- cash received
      'ready',             -- packed, waiting for the customer to collect it
      'completed',         -- in the customer's hands
      'cancelled'
    );
  END IF;

  -- BUSINESS RULE: one value, because there is no courier or postal service here
  -- to hand an order to. Every order is collected in person. Kept as an enum so
  -- adding a method later is a migration and a decision, not an accident.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfilment_method') THEN
    CREATE TYPE fulfilment_method AS ENUM ('pickup');
  END IF;

  -- BUSINESS RULE: one value. Cash, in person, at collection. No gateway, no card,
  -- no wallet, and no bank transfer either — kept as an enum so adding a method
  -- later is a migration and a decision, not an accident.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash_on_pickup');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
    CREATE TYPE product_category AS ENUM ('phone', 'beauty', 'journals', 'fitness', 'clothing');
  END IF;

  -- The invoice's own lifecycle, separate from the order's. A submitted order is
  -- pending until Patricia issues the invoice; 'void' is for an order that fell
  -- through.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('pending', 'issued', 'paid', 'void');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- products — the catalogue Patricia edits from /admin/products
-- ---------------------------------------------------------------------------
-- lib/product-store.js reads and writes this table. Edit it through
-- /admin/products, never by hand.
CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,                    -- e.g. 'bb-case-signature-noir'
  title         TEXT NOT NULL,
  -- One-line card copy. Named `blurb` to match lib/product-store.js exactly; do
  -- not rename it here without renaming it there.
  blurb         TEXT,
  description   TEXT,

  category      product_category NOT NULL,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  compare_at    NUMERIC(10,2) CHECK (compare_at IS NULL OR compare_at > price),
  currency      CHAR(3) NOT NULL DEFAULT 'SBD',
  stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  badge         TEXT,
  -- Gallery, in display order. images[1] (SQL is 1-based) is the primary: it is
  -- what the shop grid and the bag show. May be empty — a product with no photo
  -- gets the placeholder tile drawn by components/ProductArt.js.
  images        TEXT[] NOT NULL DEFAULT '{}',  -- '/uploads/<name>' or object-storage URLs
  -- Hiding is the reversible step and the only one the shop cares about. A row can
  -- be deleted for good afterwards, but never in one action while it is still live.
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  -- There are deliberately no brands, models or art columns. A product carries no
  -- device list, no variant list and no mockup-style key: Patricia asked for those
  -- to go, and anything a customer must specify goes in the note at checkout.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The shop filters by category only, so that is what is indexed. The partial
-- index matches the shop's own query, which only ever asks for unarchived rows.
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_live_idx     ON products (category) WHERE NOT archived;

-- ---------------------------------------------------------------------------
-- customers — the people who order from the shop
-- ---------------------------------------------------------------------------
-- AN ACCOUNT IS REQUIRED TO ORDER. The phone number is the login handle because
-- Patricia's customers mostly have no email address; it is UNIQUE, digits only,
-- and normalised in lib/customers.js. Passwords are scrypt hashes.
--
-- Apply db/migrations/001_customer_accounts.sql to an existing database; this
-- definition is what a fresh one gets.
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,                    -- 'cus_<uuid>'
  phone         TEXT NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{6,15}$'),
  name          TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
  location      TEXT,                                -- prefilled into checkout
  email         TEXT,                                -- contact only, not a login

  -- The community face: a name she chooses for the room and a picture. The room
  -- gates on community_profile_set_at. The phone number is NOT duplicated — it is
  -- `phone` above, and is displayed beside her name in the chat.
  community_name            TEXT,
  avatar                    TEXT,                    -- '/uploads/a-<uuid>.<ext>'
  community_profile_set_at  TIMESTAMPTZ,
  password_hash TEXT NOT NULL,                       -- scrypt$<salt>$<hash>
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC);

-- ---------------------------------------------------------------------------
-- signup_verifications — the pending half of a sign-up
-- ---------------------------------------------------------------------------
-- Sign-up is two steps: this row holds the details and the hashed code while the
-- SMS is in flight, and the customer row is only created when /api/account/verify
-- accepts the code. Applying db/schema.sql to a fresh database without this table
-- would make registration fail at the first request.
CREATE TABLE IF NOT EXISTS signup_verifications (
  phone         TEXT PRIMARY KEY CHECK (phone ~ '^[0-9]{6,15}$'),
  code_hash     TEXT NOT NULL,
  name          TEXT NOT NULL,
  location      TEXT,
  email         TEXT,
  password_hash TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS signup_verifications_expires_idx
  ON signup_verifications (expires_at);

-- ---------------------------------------------------------------------------
-- orders — one row per manual order request
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  -- TEXT, not UUID: lib/orders.js prefixes its ids ('ord_<uuid>', and 'ord_seed_1'
  -- for the seeds), so a UUID column would reject every row the app creates.
  id                TEXT PRIMARY KEY,

  order_number      TEXT NOT NULL UNIQUE,            -- BB-20260823-4817

  -- The customer's private key to her own invoice at /invoice/<token>.
  -- SECURITY: a shop customer has no account, so this token is the entire
  -- authorisation. 24 random bytes, base64url. NEVER look an invoice up by
  -- order_number — that value is short, printed on paper and guessable.
  invoice_token     TEXT NOT NULL UNIQUE CHECK (char_length(invoice_token) >= 20),

  -- The account that placed the order. NULL only for orders taken before accounts
  -- existed: they keep their own snapshot of the customer details below, so an
  -- orphaned order is still readable and printable. ON DELETE SET NULL, never
  -- CASCADE — deleting an account must not delete what was sold.
  customer_id       TEXT REFERENCES customers (id) ON DELETE SET NULL,

  status            order_status NOT NULL DEFAULT 'new',

  -- The invoice is issued by Patricia, not by the act of arranging collection.
  -- 'pending' is the default, so a new order is a request rather than a bill.
  invoice_status    invoice_status NOT NULL DEFAULT 'pending',
  invoice_issued_at TIMESTAMPTZ,
  -- When the cash was collected. Stamped the first time the invoice is marked
  -- Paid; the income figures on /admin read this and nothing else.
  paid_at           TIMESTAMPTZ,


  -- Customer details. Kept on the order rather than in a customers table:
  -- there are no accounts, and people reorder with different phones.
  customer_name     TEXT NOT NULL CHECK (char_length(trim(customer_name)) >= 2),
  customer_phone    TEXT NOT NULL CHECK (char_length(trim(customer_phone)) >= 6),
  customer_email    TEXT,                            -- optional, many customers have none
  customer_location TEXT NOT NULL,                   -- village / suburb / province
  notes             TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),

  fulfilment        fulfilment_method NOT NULL DEFAULT 'pickup',
  payment_method    payment_method NOT NULL,

  -- Collection details, written ONLY from /admin. The customer never sends these:
  -- Patricia decides where and when, saves them here so she does not have to
  -- remember, then messages the customer herself. Empty string = not arranged yet.
  pickup_place      TEXT NOT NULL DEFAULT '' CHECK (char_length(pickup_place) <= 120),
  pickup_when       TEXT NOT NULL DEFAULT '' CHECK (char_length(pickup_when)  <= 80),
  pickup_note       TEXT NOT NULL DEFAULT '' CHECK (char_length(pickup_note)  <= 500),


  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'SBD',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The arithmetic is computed server-side in buildOrder(); this makes the
  -- database refuse a row where it does not add up. Nothing is ever added on top
  -- of the lines: orders are collected in person, so there is no delivery fee.
  CONSTRAINT orders_total_matches CHECK (total = subtotal)
);

-- The dashboard lists newest first and filters by status.
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx     ON orders (status);
-- The account page reads one customer's orders newest-first.
CREATE INDEX IF NOT EXISTS orders_customer_idx   ON orders (customer_id, created_at DESC);
-- The dashboard filters invoices that are still pending.
CREATE INDEX IF NOT EXISTS orders_invoice_status_idx ON orders (invoice_status);
-- The dashboard's week/month/year income figures read paid invoices only.
CREATE INDEX IF NOT EXISTS orders_paid_at_idx
  ON orders (paid_at DESC) WHERE invoice_status = 'paid';

-- ---------------------------------------------------------------------------
-- order_items — the lines of an order
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,        -- intentionally NOT a FK: an order line must
                                    -- survive a product being removed
  title       TEXT NOT NULL,        -- snapshot of the name at order time
  -- Legacy. Products carry no variants, so nothing writes this any more: every
  -- line created by lib/orders.js stores ''. Kept only so the seed orders and any
  -- pre-existing data still migrate. Drop it once that history no longer matters.
  model       TEXT,

  qty         INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 25),
  unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  line_total  NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),

  CONSTRAINT order_items_line_total_matches CHECK (line_total = unit_price * qty)
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- ---------------------------------------------------------------------------
-- admin_users (OPTIONAL)
-- ---------------------------------------------------------------------------
-- Today there is a single operator and lib/auth.js compares against
-- ADMIN_EMAIL / ADMIN_PASSWORD from the environment. Create this table only
-- when a second person needs access; then store an argon2id or bcrypt hash
-- here and never the password itself.
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,       -- argon2id / bcrypt output, never plaintext
  display_name  TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- members — LEGACY/UNUSED (kept for old data; community members are customers)
-- ---------------------------------------------------------------------------
-- The app no longer reads or writes this table. A shop account and a community
-- account are the same `customers` row now, and the community chat uses
-- community_messages below. Keep the table only while old rows still matter.
--
-- password_hash holds scrypt output in the form scrypt$<saltHex>$<hashHex> (see
-- lib/community-auth.js). Never store a plaintext password here, and never send
-- this column to the browser.
CREATE TABLE IF NOT EXISTS members (
  -- TEXT, not UUID, for the same reason as orders.id above: the retired member
  -- store created ids as 'mem_<uuid>'. A UUID column would reject legacy rows.
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
  email         TEXT NOT NULL UNIQUE,   -- stored lower-cased; it is the login handle
  phone         TEXT,                   -- optional, so Patricia can reach her
  location      TEXT,
  -- Her own description of herself, shown to other members when they
  -- tap her name. Capped short on purpose: an introduction, not a page.
  bio           TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 280),
  -- Profile picture: '/uploads/<name>' today, an object-storage URL once uploads
  -- move off the filesystem. NULL means "show her initials".
  avatar        TEXT,
  password_hash TEXT NOT NULL,
  -- Removed rather than deleted: she cannot sign in, her posts stay, and letting
  -- her back in is one UPDATE.
  removed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS members_active_idx ON members (created_at DESC) WHERE NOT removed;

-- ---------------------------------------------------------------------------
-- community_messages — the chat room (lib/community.js)
-- ---------------------------------------------------------------------------
-- One room, one stream of messages. author_name is a SNAPSHOT of the member's
-- display name, deliberately duplicated: rendering the room then needs no join
-- against members, so reading the chat never loads anybody's email or phone.
--
-- author_id is nullable so a message survives its author's record being purged
-- for a privacy request. It is TEXT and deliberately NOT a foreign key:
--
--   * lib/community.js writes ids as 'msg_<uuid>', and the retired member store
--     wrote 'mem_<uuid>', neither of which is a valid UUID.
--   * Patricia's own messages carry author_id = 'owner' (OWNER_AUTHOR in
--     lib/community.js). She has no member row at all — she never signed up — so
--     a foreign key to members would reject every message the founder posts,
--     including the seeded welcome message.
--
-- from_owner is what actually marks her messages, and it is how the gold
-- "Founder" badge is drawn.
CREATE TABLE IF NOT EXISTS community_messages (
  id          TEXT PRIMARY KEY,
  author_id   TEXT,
  author_name TEXT NOT NULL,
  from_owner  BOOLEAN NOT NULL DEFAULT FALSE,
  body        TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  -- Patricia pins the house rules, the meet-up date, the answer that keeps being
  -- asked for. Pinned messages render in a strip above the conversation.
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The room reads the newest N, and the poll reads everything after one row.
CREATE INDEX IF NOT EXISTS community_messages_created_at_idx
  ON community_messages (created_at DESC);

-- Partial: the pinned strip is fetched on every poll, and pins are rare.
CREATE INDEX IF NOT EXISTS community_messages_pinned_idx
  ON community_messages (created_at DESC) WHERE pinned;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ===========================================================================
-- Queries the app needs — drop these straight into lib/orders.js
-- ===========================================================================
--
-- readOrders() — newest first, items nested:
--
--   SELECT o.*,
--          COALESCE(
--            json_agg(
--              json_build_object(
--                'productId', i.product_id, 'title', i.title, 'model', i.model,
--                'qty', i.qty, 'unitPrice', i.unit_price, 'lineTotal', i.line_total
--              ) ORDER BY i.id
--            ) FILTER (WHERE i.id IS NOT NULL),
--            '[]'
--          ) AS items
--   FROM orders o
--   LEFT JOIN order_items i ON i.order_id = o.id
--   GROUP BY o.id
--   ORDER BY o.created_at DESC;
--
-- insertOrder() — one transaction, parameterised (never string-concatenated):
--
--   BEGIN;
--     INSERT INTO orders (id, order_number, invoice_token, customer_name,
--       customer_phone, customer_email, customer_location, notes, fulfilment,
--       payment_method, subtotal, total)
--     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
--     RETURNING id;
--     -- The id comes from buildOrder() ('ord_<uuid>'), so it is passed in rather
--     -- than generated here: the app already holds it.

--     -- then one INSERT per line with the returned id
--   COMMIT;

--
-- readOrderByInvoiceToken() — the customer's own invoice, no session involved.
-- Match on invoice_token ONLY. Adding "OR order_number = $1" here would let
-- anyone read any invoice by guessing a reference:
--
--   SELECT ... FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
--    WHERE o.invoice_token = $1
--   GROUP BY o.id;
--

-- updateOrderStatus() — the enum makes an invalid status impossible:
--
--   UPDATE orders SET status = $2 WHERE id = $1 RETURNING *;
--
-- setOrderPickup() — admin only; the length caps live in the CHECKs above:
--
--   UPDATE orders
--      SET pickup_place = $2, pickup_when = $3, pickup_note = $4, updated_at = now()
--    WHERE id = $1
--   RETURNING *;
--
-- getOrderStats():
--
--   SELECT count(*) AS total,
--          count(*) FILTER (WHERE status = 'new') AS new_count,
--          count(*) FILTER (WHERE status = 'awaiting_payment') AS awaiting_payment,
--          count(*) FILTER (WHERE status = 'completed') AS completed,
--          COALESCE(sum(total) FILTER (WHERE status IN ('paid','ready','completed')), 0) AS revenue
--   FROM orders;
--
-- ===========================================================================
-- Queries for lib/product-store.js
-- ===========================================================================
--
-- readProducts() — the admin list, archived included:
--
--   SELECT * FROM products ORDER BY created_at;
--
-- readActiveProducts() — what the shop and the cart are allowed to see:
--
--   SELECT * FROM products WHERE NOT archived ORDER BY created_at;
--
-- getProduct() — archived included ON PURPOSE, so an item archived while it sat
-- in someone's bag can still be priced rather than losing the sale:
--
--   SELECT * FROM products WHERE id = $1;
--
-- insertProduct() / replaceProduct() — one upsert covers both:
--
--   INSERT INTO products (id, title, blurb, description, category, price,
--     compare_at, stock, featured, badge, images)
--   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
--   ON CONFLICT (id) DO UPDATE SET
--     title = EXCLUDED.title, blurb = EXCLUDED.blurb,
--     description = EXCLUDED.description, category = EXCLUDED.category,
--     price = EXCLUDED.price, compare_at = EXCLUDED.compare_at,
--     stock = EXCLUDED.stock, featured = EXCLUDED.featured,
--     badge = EXCLUDED.badge, images = EXCLUDED.images
--   RETURNING *;
--   -- `archived` is deliberately absent: an edit must never un-hide a product.
--   -- Only setProductArchived() touches it.

--
-- setProductArchived() — hide or restore:
--
--   UPDATE products SET archived = $2 WHERE id = $1 RETURNING *;
--
-- deleteProduct() — permanent, and only ever on an already-hidden product. The
-- `AND archived` is the rule, not a convenience: zero rows back means it was still
-- live and must be hidden first. order_items.product_id is deliberately not a
-- foreign key and each line snapshots its own title and unit price, so deleting a
-- product leaves order history intact:
--
--   DELETE FROM products WHERE id = $1 AND archived RETURNING *;
--
-- getProductStats():
--
--   SELECT count(*) FILTER (WHERE NOT archived) AS live,
--          count(*) FILTER (WHERE archived) AS archived,
--          count(*) FILTER (WHERE NOT archived AND stock = 0) AS sold_out
--   FROM products;
--
-- Historical only: if you are importing an old JSON order store, replay each
-- entry through the insertOrder() statements above. Keep the original order_number
-- values so references Patricia has already given to customers still match.
-- ===========================================================================
