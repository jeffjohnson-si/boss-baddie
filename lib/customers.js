import crypto from 'node:crypto';
import { pool } from '@/lib/db';

/**
 * CUSTOMER STORE — the shop account (server only)
 * ===============================================
 * One row per person who orders. The phone number is the login handle, so there
 * is no "email or phone" ambiguity anywhere: normalise first, then look up.
 *
 * WHY PHONE: Patricia's customers reach her on WhatsApp and mostly leave the
 * email field blank, so a phone number is the one identifier everybody has.
 *
 * Accounts are PASSWORDLESS: a six-digit code is texted to the phone for sign-up
 * and again for any later sign-in. There is no password to store, reset or hash.
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

/** The public shape of a customer. The password hash never leaves this module. */
function mapCustomer(row) {
  if (!row) return null;
  // The community keeps a display name and a picture of its own, because a
  // woman may want to appear there differently from how her order is addressed.
  // The phone number is never editable here: it is the login handle.
  const communityName = row.community_name ?? '';
  const avatar = row.avatar ?? null;

  return {
    id: row.id,
    name: row.name,
    displayName: communityName || row.name,
    communityName,
    avatar,
    communityProfileSetAt: row.community_profile_set_at ?? null,
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
 * phone is not part of the body at all (changing it would change the login).
 */
function validateDetails(payload, { partial = false } = {}) {
  const errors = [];

  const name = String(payload?.name ?? '').trim();
  const location = String(payload?.location ?? '').trim();
  const email = String(payload?.email ?? '').trim();

  if (!partial || payload?.name !== undefined) {
    if (name.length < NAME_MIN) errors.push('Tell us your name.');
    else if (name.length > NAME_MAX) errors.push(`Keep your name to ${NAME_MAX} characters.`);
  }

  if (location.length > LOCATION_MAX) errors.push(`Keep your location to ${LOCATION_MAX} characters.`);

  if (email) {
    if (email.length > EMAIL_MAX) errors.push(`Keep your email to ${EMAIL_MAX} characters.`);
    else if (!EMAIL_PATTERN.test(email)) errors.push('That email address does not look right.');
  }

  return { errors, name, location, email };
}

/**
 * Validate a sign-up WITHOUT writing anything.
 *
 * Sign-up is two steps now — details, then a texted code — so validation has to
 * be separable from creation: the register route validates, stores a pending
 * verification and sends the SMS, and only the verify route creates the row.
 *
 * @returns {{ok:true, values:{phone:string,name:string,location:string,email:string}} | {ok:false, errors:string[]}}
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
      phone,
      name: details.name,
      location: details.location,
      email: details.email,
    },
  };
}

/**
 * Is this number already an account? Checked before a code is texted (no point
 * paying for a message to somebody who can already sign in) and again on verify,
 * because a sign-up can be overtaken by another one between the two steps.
 */
export async function phoneTaken(phoneInput) {
  const phone = normalizePhone(phoneInput) ?? '';
  if (!phone) return false;
  const { rows } = await pool.query('SELECT 1 FROM customers WHERE phone = $1', [phone]);
  return rows.length > 0;
}

/**
 * Create the customer once her code has been verified.
 *
 * No password and no secret arrives here: the only thing that proves the number
 * is the code checked by the verify route.
 *
 * The UNIQUE index is the real guard: two people verifying the same number at once
 * both pass the "does it exist" read, and the second insert fails on the
 * constraint. That is caught here and answered with the same message as the read.
 */
export async function createCustomer({ phone, name, location, email }) {
  const id = `cus_${crypto.randomUUID()}`;

  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (id, phone, name, location, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone, location, email, session_version, created_at`,
      [id, phone, name, location || null, email || null],
    );
    return { ok: true, customer: mapCustomer(rows[0]) };
  } catch (error) {
    if (error?.code === '23505') {
      return { ok: false, errors: ['That number already has an account. Sign in instead.'] };
    }
    console.error('[customers] registration failed:', error);
    throw new Error('Could not create the account.');
  }
}

/** One customer by phone number, or null. Used by the passwordless login verify step. */
export async function getCustomerByPhone(phoneInput) {
  const phone = normalizePhone(phoneInput);
  if (!phone) return null;

  const { rows } = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
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
    'SELECT id, name, community_name, avatar, community_profile_set_at, phone, location, email, session_version, created_at FROM customers WHERE id = $1',
    [key],
  );
  return mapCustomer(rows[0]);
}

/** Update the editable fields. The phone number is deliberately not one of them. */
export async function updateCustomerProfile(id, payload) {
  const { errors, name, location, email } = validateDetails(payload, { partial: true });
  if (errors.length > 0) return { ok: false, errors };

  const { rows } = await pool.query(
    `UPDATE customers
        SET name = $2, location = $3, email = $4, updated_at = now()
      WHERE id = $1
      RETURNING id, name, phone, location, email, created_at`,
    [id, name, location || null, email || null],
  );

  if (rows.length === 0) return { ok: false, errors: ['That account no longer exists.'] };
  return { ok: true, customer: mapCustomer(rows[0]) };
}

/**
 * The people in The Baddies Corner, for the member list beside the chat.
 *
 * COMMUNITY MEMBERS ARE CUSTOMERS. There is no separate member table any more, so
 * this is the only list the room needs. It deliberately carries nothing private:
 * a name, when she joined, and nothing else. Emails and phone numbers live on
 * /admin and are never part of this shape.
 */
export async function readCustomersForRoom(limit = 200) {
  const { rows } = await pool.query(
    'SELECT id, name, community_name, avatar, created_at FROM customers ORDER BY created_at DESC LIMIT $1',
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    // Her community name if she chose one, otherwise the name on the account.
    name: row.community_name || row.name,
    avatar: row.avatar,
    // Deliberately no phone number. The room only ever needs a name and a face;
    // contact details stay between her and Patricia on /admin.
    bio: '',
    joinedAt: row.created_at,
  }));
}

/**
 * Has she set up her community face yet?
 *
 * The account gives us a name and a phone number; the room asks for the name she
 * wants to be known by and a picture, once, before she walks in. That is the only
 * extra step between registering and reading the chat.
 */
export function isCommunityProfileComplete(customer) {
  return Boolean(customer?.communityProfileSetAt);
}

/**
 * Save the community profile: display name, and optionally a new picture.
 *
 * The phone number is not part of this: it was set when the account was created
 * and is displayed beside her name, not chosen here.
 */
export async function setCommunityProfile(customerId, { displayName, avatar }) {
  const name = String(displayName ?? '').trim();
  if (name.length < 2) return { ok: false, errors: ['Tell the room what to call you.'] };
  if (name.length > 40) return { ok: false, errors: ['Keep your name to 40 characters.'] };

  const { rows } = await pool.query(
    `UPDATE customers
        SET community_name = $2,
            avatar = COALESCE($3, avatar),
            community_profile_set_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING id, name, community_name, avatar, community_profile_set_at, phone, location, email, created_at`,
    [customerId, name, avatar ?? null],
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

/** Counters for the admin community header. */
export async function getCustomerTotals() {
  const { rows } = await pool.query(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS this_month
       FROM customers`,
  );

  return {
    total: Number(rows[0].total),
    thisMonth: Number(rows[0].this_month),
  };
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
