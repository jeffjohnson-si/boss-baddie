import crypto from 'node:crypto';
import { pool } from '@/lib/db';

/**
 * CUSTOMER STORE — the shop account (server only)
 * ===============================================
 * One row per person who orders. The EMAIL ADDRESS is the login handle, so there
 * is no "email or phone" ambiguity anywhere: normalise first, then look up.
 *
 * WHY EMAIL: the sign-in code is delivered by email through Brevo, which costs
 * nothing to run and works everywhere. The phone number is still collected as
 * contact information — Patricia arranges collections in person — but it is not
 * verified, not unique, and never used to sign in.
 *
 * Accounts are PASSWORDLESS: a six-digit code is emailed for sign-up and again
 * for any later sign-in. There is no password to store, reset or hash.
 *
 * EVERY WRITE VALIDATES HERE, not in the route, so the API and any future import
 * script obey the same rules.
 */

const NAME_MIN = 2;
const NAME_MAX = 60;
const LOCATION_MAX = 120;
const EMAIL_MAX = 120;

/**
 * Reduce anything a customer types to the canonical stored form.
 *
 *   "+677 740 0000" -> "7400000"      (Solomon Islands country code dropped)
 *   "677-7400000"   -> "7400000"
 *   "7400000"       -> "7400000"
 *   "07400000"      -> "07400000"     (leading zero kept — not ours to invent)
 *
 * Returns null when there is no number worth storing, so uniqueness means one
 * number is one account even if she types it three different ways.
 */
export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;

  // 677 is the Solomon Islands code. Only strip it when what remains is a real
  // number, so a legitimate local number beginning 677 is left alone.
  if (digits.startsWith('677') && digits.length > 7) digits = digits.slice(3);

  if (digits.length < 6 || digits.length > 15) return null;
  return digits;
}

/** How a stored number is displayed back to a person. */
export function formatPhone(digits) {
  const value = String(digits ?? '');
  if (value.length === 7) return `+677 ${value.slice(0, 3)} ${value.slice(3)}`;
  return `+${value}`;
}

/**
 * The canonical stored form of an email address: trimmed and lowercased.
 *
 * Lowercasing is what makes "Patricia@Example.com" and "patricia@example.com"
 * the same account — the unique index is on lower(email), and the code hash is
 * computed from this exact string, so both must agree.
 *
 * Returns null when it is empty or obviously not an address.
 */
export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX) return null;
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** The public shape of a customer. The password hash never leaves this module. */
function mapCustomer(row) {
  if (!row) return null;
  // The phone number is never editable here: it is the login handle.
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneDisplay: formatPhone(row.phone),
    location: row.location ?? '',
    email: row.email ?? '',
    sessionVersion: row.session_version ?? 0,
    createdAt: row.created_at,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate the human-facing fields. `partial` is for profile edits, where the
 * email is not part of the body at all (changing it would change the login).
 */
function validateDetails(payload, { partial = false } = {}) {
  const errors = [];

  const name = String(payload?.name ?? '').trim();
  const location = String(payload?.location ?? '').trim();
  const email = normalizeEmail(payload?.email);

  if (!partial || payload?.name !== undefined) {
    if (name.length < NAME_MIN) errors.push('Tell us your name.');
    else if (name.length > NAME_MAX) errors.push(`Keep your name to ${NAME_MAX} characters.`);
  }

  if (location.length > LOCATION_MAX) errors.push(`Keep your location to ${LOCATION_MAX} characters.`);

  // A full sign-up requires a valid address; a profile edit never carries one.
  if (!partial && !email) {
    errors.push(
      String(payload?.email ?? '').trim()
        ? 'That email address does not look right.'
        : 'Enter an email address — that is how you sign in.',
    );
  }

  return { errors, name, location, email };
}

/**
 * Validate a sign-up WITHOUT writing anything.
 *
 * Sign-up is two steps — details, then an emailed code — so validation has to be
 * separable from creation: the register route validates, stores a pending
 * verification and sends the email, and only the verify route creates the row.
 *
 * @returns {{ok:true, values:{email:string,name:string,phone:string,location:string}} | {ok:false, errors:string[]}}
 */
export function validateSignup(payload) {
  const errors = [];

  const phone = normalizePhone(payload?.phone);
  if (!phone) errors.push('Enter a phone number we can reach you on.');

  const details = validateDetails(payload);
  errors.push(...details.errors);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      email: details.email,
      name: details.name,
      phone,
      location: details.location,
    },
  };
}

/**
 * Is this address already an account? Checked before a code is emailed (no point
 * sending mail to somebody who can already sign in) and again on verify, because
 * a sign-up can be overtaken by another one between the two steps.
 */
export async function emailTaken(emailInput) {
  const email = normalizeEmail(emailInput);
  if (!email) return false;
  const { rows } = await pool.query('SELECT 1 FROM customers WHERE lower(email) = $1', [email]);
  return rows.length > 0;
}

/**
 * Create the customer once her code has been verified.
 *
 * No password and no secret arrives here: the only thing that proves the address
 * is the code checked by the verify route.
 *
 * The UNIQUE index is the real guard: two people verifying the same address at
 * once both pass the "does it exist" read, and the second insert fails on the
 * constraint. That is caught here and answered with the same message as the read.
 */
export async function createCustomer({ email, name, phone, location }) {
  const id = `cus_${crypto.randomUUID()}`;
  const address = normalizeEmail(email);
  if (!address) throw new Error('createCustomer needs a valid email address.');

  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (id, email, name, phone, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone, location, email, session_version, created_at`,
      [id, address, name, phone, location || null],
    );
    return { ok: true, customer: mapCustomer(rows[0]) };
  } catch (error) {
    if (error?.code === '23505') {
      return { ok: false, errors: ['That email already has an account. Sign in instead.'] };
    }
    console.error('[customers] registration failed:', error);
    throw new Error('Could not create the account.');
  }
}

/** One customer by email address, or null. Used by the passwordless login step. */
export async function getCustomerByEmail(emailInput) {
  const email = normalizeEmail(emailInput);
  if (!email) return null;

  const { rows } = await pool.query('SELECT * FROM customers WHERE lower(email) = $1', [email]);
  return mapCustomer(rows[0]);
}

/** Stamp the last successful sign-in. */
export async function recordCustomerLogin(id) {
  if (!id) return;
  await pool.query('UPDATE customers SET last_login_at = now() WHERE id = $1', [id]);
}

/** One customer by id, or null if she no longer exists. */
export async function getCustomerById(id) {
  const key = String(id ?? '');
  if (!key) return null;

  const { rows } = await pool.query(
    'SELECT id, name, phone, location, email, session_version, created_at FROM customers WHERE id = $1',
    [key],
  );
  return mapCustomer(rows[0]);
}

/**
 * Update the editable fields.
 *
 * The email address is deliberately not one of them: it is the login handle, so
 * changing it needs a fresh code, not a form edit. The phone number is fixed for
 * the same practical reason — Patricia arranges collections on it, and an account
 * that silently changes its contact number is one she cannot call.
 */
export async function updateCustomerProfile(id, payload) {
  const { errors, name, location } = validateDetails(payload, { partial: true });
  if (errors.length > 0) return { ok: false, errors };

  const { rows } = await pool.query(
    `UPDATE customers
        SET name = $2, location = $3, updated_at = now()
      WHERE id = $1
      RETURNING id, name, phone, location, email, created_at`,
    [id, name, location || null],
  );

  if (rows.length === 0) return { ok: false, errors: ['That account no longer exists.'] };
  return { ok: true, customer: mapCustomer(rows[0]) };
}

/** The admin list: the contact details Patricia needs, and nothing else. */
export async function readCustomersForAdmin(limit = 500) {
  const { rows } = await pool.query(
    `SELECT id, name, phone, location, email, created_at, last_login_at
       FROM customers
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneDisplay: formatPhone(row.phone),
    location: row.location ?? '',
    email: row.email ?? '',
    joinedAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

/**
 * Counters for the account dashboard.
 *
 * `spent` counts paid, ready and completed orders — the same rule the admin
 * revenue figure uses, so the two numbers cannot disagree. `due` is what is still
 * owed on collection.
 */
export async function getCustomerStats(customerId) {
  const { rows } = await pool.query(
    `SELECT
       count(*)                                                              AS orders,
       count(*) FILTER (WHERE status IN ('paid','ready','completed'))         AS settled,
       count(*) FILTER (WHERE status IN ('new','awaiting_payment'))           AS open,
       COALESCE(sum(total) FILTER (WHERE status IN ('paid','ready','completed')), 0) AS spent,
       COALESCE(sum(total) FILTER (WHERE status IN ('new','awaiting_payment')), 0)   AS due
     FROM orders
     WHERE customer_id = $1`,
    [customerId],
  );

  const stats = rows[0];
  return {
    orders: Number(stats.orders),
    settled: Number(stats.settled),
    open: Number(stats.open),
    spent: Number(stats.spent),
    due: Number(stats.due),
  };
}
