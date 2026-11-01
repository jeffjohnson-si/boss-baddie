import { pool } from '@/lib/db';
import {
  generateCode,
  hashCode,
  safeEqual,
  VERIFICATION_RULES,
} from '@/lib/verification';

/**
 * CUSTOMER LOGIN CODES  (server only)
 * ===================================
 * The same six-digit rules as sign-up, but for an account that already exists:
 * phone number in, code texted, code back, session issued.
 *
 * Codes live in their own table so a pending sign-up and a pending login for the
 * same number cannot overwrite each other.
 *
 * The code is stored as an HMAC of phone + code, keyed with
 * CUSTOMER_SESSION_SECRET. A leaked row cannot be turned back into a working
 * code without the server secret.
 */

const { TTL_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SECONDS } = VERIFICATION_RULES;

async function purgeExpired() {
  try {
    await pool.query('DELETE FROM customer_login_codes WHERE expires_at < now()');
  } catch (error) {
    console.error('[login-verification] could not purge expired rows:', error);
  }
}

/**
 * Issue a login code. Replaces any earlier code for the number, so requesting a
 * second one does not leave two valid codes alive.
 *
 * @returns {Promise<string>} the code, which the caller texts and then forgets
 */
export async function startLoginVerification(phone) {
  await purgeExpired();

  const code = generateCode();

  await pool.query(
    `INSERT INTO customer_login_codes
       (phone, code_hash, attempts, sent_at, expires_at)
     VALUES ($1, $2, 0, now(), now() + interval '${TTL_MINUTES} minutes')
     ON CONFLICT (phone) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       attempts = 0,
       sent_at = now(),
       expires_at = EXCLUDED.expires_at`,
    [phone, hashCode(phone, code)],
  );

  return code;
}

/** Seconds still to wait before another login code may be sent, or 0. */
export async function resendLoginCooldownSeconds(phone) {
  const { rows } = await pool.query(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (sent_at + interval '${RESEND_COOLDOWN_SECONDS} seconds' - now()))))::int AS wait
       FROM customer_login_codes WHERE phone = $1`,
    [phone],
  );
  return rows[0]?.wait ?? 0;
}

export async function consumeLoginCode(phone) {
  await pool.query('DELETE FROM customer_login_codes WHERE phone = $1', [phone]);
}

/**
 * Check a submitted login code and consume it on success.
 *
 * @returns {Promise<{ok:true} | {ok:false, reason:'missing'|'expired'|'too_many'|'wrong', attemptsLeft?:number}>}
 */
export async function checkLoginCode(phone, codeInput) {
  const code = String(codeInput ?? '').replace(/\D/g, '');
  if (code.length !== 6) return { ok: false, reason: 'wrong', attemptsLeft: null };

  const { rows } = await pool.query(
    'SELECT * FROM customer_login_codes WHERE phone = $1',
    [phone],
  );
  const pending = rows[0];
  if (!pending) return { ok: false, reason: 'missing' };

  if (new Date(pending.expires_at).getTime() <= Date.now()) {
    await consumeLoginCode(phone);
    return { ok: false, reason: 'expired' };
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await consumeLoginCode(phone);
    return { ok: false, reason: 'too_many' };
  }

  if (!safeEqual(hashCode(phone, code), pending.code_hash)) {
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await consumeLoginCode(phone);
    } else {
      await pool.query(
        'UPDATE customer_login_codes SET attempts = $2 WHERE phone = $1',
        [phone, attempts],
      );
    }
    return { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
  }

  await consumeLoginCode(phone);
  return { ok: true };
}
