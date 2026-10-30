import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from '@/lib/community-auth';

/**
 * CUSTOMER AUTH — the shop account (server only)
 * ===============================================
 * A third identity, deliberately separate from the other two:
 *
 *   lib/auth.js            Patricia's owner account and admin session.
 *   lib/community-auth.js  members of The Baddies Corner (email handle).
 *   this file              people who buy things (phone handle, 60-day session).
 *
 * WHY SEPARATE: an account that can spend money and see a delivery address should
 * not be the same session as one that can post in a chat room, and neither should
 * share a signing key with the admin dashboard. Three cookies, three secrets.
 *
 * PASSWORDS are scrypt hashes in the same format the community already uses, and
 * that implementation is imported rather than copied — one password format in the
 * codebase, so a future hardening pass (argon2id, higher cost) happens once.
 *
 * SESSION is a signed httpOnly cookie carrying the customer id:
 *   <customerId>.<expiryEpochSeconds>.<signature>
 *
 * 60 days, because this is now an app someone installs on their phone and opens
 * weeks later. The record is re-read on every request, so a deleted account stops
 * working at her next page even though the cookie itself is still valid.
 *
 * WHAT THIS DOES NOT DO — see README "Security hardening":
 *   - No self-service password reset. Patricia can issue a temporary password
 *     from /admin/community.
 *   - Password changes and admin resets increment session_version; older cookies
 *     stop working at their next request.
 */

export const CUSTOMER_COOKIE = 'bb_customer_session';

/**
 * 400 days — "stay signed in until I log out".
 *
 * That is the longest lifetime a cookie can carry in Chrome (and close to it in
 * Safari and Firefox), so it is the practical maximum rather than an arbitrary
 * one. A cookie with an expiry survives a closed browser, unlike a session cookie,
 * which is why she is still signed in tomorrow morning.
 *
 * 400 days is still a date, though, so the session is RENEWED while she uses the
 * app: components/SessionKeeper.js asks /api/account/session/refresh once a day and
 * the server issues a fresh 400-day cookie. Logging out is the only thing that ends
 * it, and it ends it everywhere.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 400;

export { hashPassword, verifyPassword };

function getSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('CUSTOMER_SESSION_SECRET is missing or too short (need 16+ characters).');
  }
  return secret;
}

/**
 * Can the shop issue sessions at all?
 *
 * Checked BEFORE a registration writes anything, for the same reason the
 * community does it: an account created without a working session is one nobody
 * can use, and its phone number is then taken forever.
 */
export function isCustomerAuthConfigured() {
  try {
    getSecret();
    return true;
  } catch {
    return false;
  }
}

/** Constant-time compare that tolerates different lengths. */
function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/**
 * Issue a session for one customer, tied to her current session version.
 * A password change or admin reset increments that version, invalidating old
 * cookies without needing a server-side session table.
 */
export function createCustomerToken(customerId, sessionVersion = 0) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const version = Number.isFinite(Number(sessionVersion)) ? Number(sessionVersion) : 0;
  const payload = `${customerId}.${version}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a customer session cookie.
 *
 * @returns {null | { customerId: string, sessionVersion: number }}
 *   null when forged, malformed or expired.
 */
export function readCustomerToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  // Four parts: id . sessionVersion . expiry . signature. Older three-part
  // cookies are deliberately rejected, so everyone signs in once after deploy.
  if (parts.length !== 4) return null;

  const [customerId, version, expiry, signature] = parts;

  // Signature first: a forged token and an expired one should look identical.
  let expected;
  try {
    expected = sign(`${customerId}.${version}.${expiry}`);
  } catch {
    return null; // secret missing — no session is valid
  }
  if (!safeEqual(signature, expected)) return null;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || Math.floor(Date.now() / 1000) >= expiresAt) return null;

  const sessionVersion = Number(version);
  if (!Number.isFinite(sessionVersion)) return null;

  return { customerId, sessionVersion };
}

/**
 * Did this request arrive over HTTPS?
 *
 * The admin and community cookies decide `secure` from NODE_ENV, which is right on
 * a deployed server and wrong on a laptop previewing a production build over
 * http://localhost — the browser accepts the login and then discards the cookie, so
 * signing in looks broken. Reading the actual request fixes both cases: behind the
 * proxy the header says https, and locally it says http.
 *
 * `x-forwarded-proto` is only trustworthy when the proxy is the sole way in, which
 * is why the firewall rule in README's deployment section matters.
 */
export function isSecureRequest(request) {
  const forwarded = request?.headers?.get?.('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';

  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

/** Cookie options. `secure` follows the request, so local previews still work. */
export function customerCookieOptions({ secure = process.env.NODE_ENV === 'production' } = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
