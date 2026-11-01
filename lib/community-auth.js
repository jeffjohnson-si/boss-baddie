import crypto from 'node:crypto';

/**
 * PASSWORD HASHING + LEGACY MEMBER SESSION (server only)
 * =====================================================
 * The scrypt helpers here are what the owner account uses (lib/admin-store.js):
 *   scrypt$<saltHex>$<hashHex>
 * with a random 16-byte salt and a constant-time compare. The plain password is
 * never written anywhere, including the logs.
 *
 * The member token helpers below are LEGACY. The community now signs in with the
 * same passwordless customer session (lib/customer-auth.js), and no code reads a
 * member cookie any more. They remain only so old data can still be read.
 */

export const MEMBER_COOKIE = 'bb_member_session';

/** 30 days — a community you have to sign into weekly is a community you leave. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** scrypt cost. 16384 is a sane floor and still fast enough on a small VPS. */
const SCRYPT_COST = 16384;
const KEY_LENGTH = 64;

function getSecret() {
  const secret = process.env.COMMUNITY_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('COMMUNITY_SESSION_SECRET is missing or too short (need 16+ characters).');
  }
  return secret;
}

/** Constant-time compare that tolerates different lengths. */
function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/** Hash a new password for storage. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH, { N: SCRYPT_COST });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Check a password against a stored hash.
 * Returns false for any malformed record rather than throwing, so one bad row
 * cannot lock everybody out.
 */
export function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  const actual = crypto.scryptSync(String(password), salt, KEY_LENGTH, { N: SCRYPT_COST });
  return crypto.timingSafeEqual(actual, expected);
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/**
 * Is the community usable at all? True when COMMUNITY_SESSION_SECRET is present
 * and long enough.
 *
 * This exists so a route can refuse BEFORE it writes anything. Sign-up used to
 * create the member row first and only then discover it could not issue a
 * session, which left an account behind that nobody could ever sign in to —
 * and, worse, an email address that could not be registered a second time.
 */
export function isCommunityConfigured() {
  try {
    getSecret();
    return true;
  } catch {
    return false;
  }
}

/** Issue a session for one member. */
export function createMemberToken(memberId) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${memberId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a member session cookie.
 * @returns {string|null} the member id, or null when forged or expired.
 */
export function readMemberToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [memberId, expiry, signature] = parts;

  // Signature first: a forged token and an expired one should look identical.
  let expected;
  try {
    expected = sign(`${memberId}.${expiry}`);
  } catch {
    return null; // secret missing — no session is valid
  }
  if (!safeEqual(signature, expected)) return null;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || Math.floor(Date.now() / 1000) >= expiresAt) return null;

  return memberId;
}

/** Cookie options. `secure` is off in dev so it still works on http://localhost. */
export function memberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
