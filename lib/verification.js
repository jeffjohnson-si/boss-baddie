import crypto from 'node:crypto';
import { pool } from '@/lib/db';

/**
 * SIGN-UP VERIFICATION — the six-digit code that proves a phone number is hers.
 * (server only)
 *
 * A code is generated here, stored as an HMAC (never in plain text), texted by
 * lib/sms.js, and checked against the same HMAC when she types it back. The account
 * itself is only created by the verify route after this module says the code is
 * right, so a half-finished sign-up never becomes a customer.
 *
 * THE RULES, and why each one exists:
 *   - 10 minutes to live. Long enough for a slow text, short enough that a stolen
 *     phone on a table is not a lasting key.
 *   - 6 digits, so 1,000,000 possibilities. With five attempts allowed per code and
 *     one code per minute per number, guessing is not a practical attack.
 *   - Five wrong tries deletes the pending row: she starts again, an attacker gets
 *     nowhere.
 *   - 60 seconds between sends, so the endpoint cannot be used to bomb a number
 *     (or run up a bill) by holding the button down.
 *   - The hash is keyed with CUSTOMER_SESSION_SECRET, so a leaked database row
 *     cannot be turned back into a working code without the server secret.
 */

const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function secret() {
  const value = process.env.CUSTOMER_SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error('CUSTOMER_SESSION_SECRET is missing or too short (need 16+ characters).');
  }
  return value;
}

/** A fresh code. crypto.randomInt, not Math.random — this is a security value. */
export function generateCode() {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

function hashCode(phone, code) {
  return crypto.createHmac('sha256', secret()).update(`${phone}:${code}`).digest('hex');
}

/** Constant-time compare of two hex strings. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Lazy housekeeping: called on every sign-up rather than by a cron nobody runs. */
async function purgeExpired() {
  try {
    await pool.query('DELETE FROM signup_verifications WHERE expires_at < now()');
  } catch (error) {
    console.error('[verification] could not purge expired rows:', error);
  }
}

/**
 * Start (or restart) verification for a number. Replaces any pending row, so
 * submitting the form twice does not leave two codes alive.
 *
 * @returns {Promise<string>} the code, which the caller must send and then forget
 */
export async function startVerification({ phone, name, location, email, passwordHash }) {
  await purgeExpired();

  const code = generateCode();

  await pool.query(
    `INSERT INTO signup_verifications
       (phone, code_hash, name, location, email, password_hash, attempts, sent_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, now(), now() + interval '${TTL_MINUTES} minutes')
     ON CONFLICT (phone) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       name = EXCLUDED.name,
       location = EXCLUDED.location,
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       attempts = 0,
       sent_at = now(),
       expires_at = EXCLUDED.expires_at`,
    [phone, hashCode(phone, code), name, location || null, email || null, passwordHash],
  );

  return code;
}

/** Seconds still to wait before another text may be sent, or 0. */
export async function resendCooldownSeconds(phone) {
  const { rows } = await pool.query(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (sent_at + interval '${RESEND_COOLDOWN_SECONDS} seconds' - now()))))::int AS wait
       FROM signup_verifications WHERE phone = $1`,
    [phone],
  );
  return rows[0]?.wait ?? 0;
}

export async function hasPending(phone) {
  const { rows } = await pool.query(
    'SELECT 1 FROM signup_verifications WHERE phone = $1 AND expires_at > now()',
    [phone],
  );
  return rows.length > 0;
}

/**
 * Check a submitted code.
 *
 * @returns {Promise<{ok:true, pending:object} | {ok:false, reason:'missing'|'expired'|'too_many'|'wrong', attemptsLeft?:number}>}
 */
export async function checkCode(phone, codeInput) {
  const code = String(codeInput ?? '').replace(/\D/g, '');
  if (code.length !== CODE_LENGTH) return { ok: false, reason: 'wrong', attemptsLeft: null };

  const { rows } = await pool.query('SELECT * FROM signup_verifications WHERE phone = $1', [phone]);
  const pending = rows[0];
  if (!pending) return { ok: false, reason: 'missing' };

  if (new Date(pending.expires_at).getTime() <= Date.now()) {
    await consumeVerification(phone);
    return { ok: false, reason: 'expired' };
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await consumeVerification(phone);
    return { ok: false, reason: 'too_many' };
  }

  if (!safeEqual(hashCode(phone, code), pending.code_hash)) {
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await consumeVerification(phone);
    } else {
      await pool.query('UPDATE signup_verifications SET attempts = $2 WHERE phone = $1', [phone, attempts]);
    }
    return { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
  }

  return { ok: true, pending };
}

/** Delete the pending row. Called on success, expiry, lockout, or a failed send. */
export async function consumeVerification(phone) {
  await pool.query('DELETE FROM signup_verifications WHERE phone = $1', [phone]);
}

/** Re-send the SAME fields with a new code. */
export async function restartVerification(phone) {
  const { rows } = await pool.query('SELECT * FROM signup_verifications WHERE phone = $1', [phone]);
  const pending = rows[0];
  if (!pending) return null;

  const code = await startVerification({
    phone: pending.phone,
    name: pending.name,
    location: pending.location ?? '',
    email: pending.email ?? '',
    passwordHash: pending.password_hash,
  });

  return code;
}

export const VERIFICATION_RULES = {
  CODE_LENGTH,
  TTL_MINUTES,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
};
