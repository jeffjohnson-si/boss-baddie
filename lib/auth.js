import crypto from 'node:crypto';

/**
 * ADMIN SESSION TOKENS  (server only)
 * ===================================
 * A signed httpOnly cookie, now carrying the admin id and a session version:
 *
 *   base64url({ sub, email, sv, iat, exp }).HMAC-SHA256
 *
 * `sv` is compared with admin_users.session_version on every request. A password
 * change or reset increments the database value, which invalidates every older
 * cookie even though the signatures remain technically valid.
 *
 * The environment credential (ADMIN_EMAIL / ADMIN_PASSWORD) is a BOOTSTRAP only:
 * it can sign in while admin_users is empty, and currentAdmin() rejects an env
 * session once a real account exists.
 */

export const SESSION_COOKIE = 'bb_admin_session';

/** Session lifetime: 12 hours, so a forgotten login on a shared laptop expires. */
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  // Failing loudly beats silently signing every cookie with a default value.
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET is missing or too short (need 16+ characters).');
  }
  return secret;
}

/** Constant-time string comparison, safe for values of differing length. */
function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Check submitted credentials against the environment.
 * Only used while there is no database admin — see currentAdmin().
 */
export function verifyCredentials(email, password) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    console.error('[auth] ADMIN_EMAIL or ADMIN_PASSWORD is not set — refusing the bootstrap login.');
    return false;
  }

  const emailOk = safeEqual(String(email ?? '').trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = safeEqual(String(password ?? ''), expectedPassword);

  return emailOk && passwordOk;
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

/**
 * Issue a session for one admin.
 *
 * @param {{ id: string, email: string, sessionVersion?: number }} admin
 *   A database admin, or { id: 'env' } for the bootstrap login.
 */
export function createSessionToken(admin) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(admin.id),
      email: String(admin.email ?? '').trim().toLowerCase(),
      sv: Number(admin.sessionVersion ?? 0),
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    }),
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a session token.
 *
 * @returns {null | { sub: string, email: string, sv: number, iat: number, exp: number }}
 *   null when forged, malformed or expired.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null; // secret missing — treat every session as invalid
  }
  if (!safeEqual(signature, expected)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object') return null;
  if (typeof data.sub !== 'string' || data.sub.length === 0) return null;
  if (!Number.isFinite(Number(data.exp))) return null;
  if (Math.floor(Date.now() / 1000) >= Number(data.exp)) return null;

  return {
    sub: data.sub,
    email: String(data.email ?? ''),
    sv: Number(data.sv ?? 0),
    iat: Number(data.iat ?? 0),
    exp: Number(data.exp),
  };
}

/**
 * Cookie options for the session.
 * `secure` is off in development so the cookie still works over http://localhost.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true, // unreadable from JavaScript, so XSS cannot steal it
    sameSite: 'lax', // blocks cross-site POSTs while keeping normal navigation
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
