import crypto from 'node:crypto';

/**
 * PASSWORD HASHING  (server only)
 * ===============================
 * The scrypt helpers the owner account uses (lib/admin-store.js):
 *   scrypt$<saltHex>$<hashHex>
 * with a random 16-byte salt and a constant-time compare. The plain password is
 * never written anywhere, including the logs.
 */

/** scrypt cost. 16384 is a sane floor and still fast enough on a small VPS. */
const SCRYPT_COST = 16384;
const KEY_LENGTH = 64;

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
