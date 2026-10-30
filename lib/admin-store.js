import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/community-auth';

/**
 * ADMIN STORE  (server only)
 * ==========================
 * Patricia's account, the extra addresses that can receive a reset link, and the
 * one-time reset tokens themselves.
 *
 * The original admin login was a single email/password pair in environment
 * variables. The environment pair is still accepted as a BOOTSTRAP only while
 * admin_users is empty; once a real account exists, all logins go through this
 * store. Passwords are scrypt hashes in the same format as customer and member
 * passwords.
 */

const MAX_RECOVERY_EMAILS = 3;
const RESET_TTL_MS = 30 * 60 * 1000;
const RECOVERY_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function mapAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    sessionVersion: row.session_version ?? 0,
    passwordChangedAt: row.password_changed_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export function normaliseEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(value));
}

export function displayNameProblems(value) {
  const name = String(value ?? '').trim();
  if (name.length < 2) return ['Enter your name.'];
  if (name.length > 60) return ['Keep your name under 60 characters.'];
  return [];
}

export function passwordProblems(value, email = '') {
  const password = String(value ?? '');
  const errors = [];

  if (password.length < 12) errors.push('Use at least 12 characters.');
  if (password.length > 200) errors.push('Keep the password under 200 characters.');
  if (password && normaliseEmail(password) === normaliseEmail(email)) {
    errors.push('Do not use your email address as the password.');
  }

  return errors;
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token ?? '')).digest('hex');
}

export function hashAdminPassword(password) {
  return hashPassword(password);
}

export function verifyAdminPassword(admin, password) {
  return verifyPassword(password, admin?.passwordHash);
}

export async function countAdmins() {
  const { rows } = await pool.query('SELECT count(*)::int AS count FROM admin_users');
  return rows[0]?.count ?? 0;
}

export async function hasAdmin() {
  return (await countAdmins()) > 0;
}

export async function getFirstAdmin() {
  const { rows } = await pool.query(
    'SELECT * FROM admin_users ORDER BY created_at ASC LIMIT 1',
  );
  return mapAdmin(rows[0]);
}

export async function getAdminByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM admin_users WHERE lower(email) = lower($1) LIMIT 1',
    [normaliseEmail(email)],
  );
  return mapAdmin(rows[0]);
}

export async function getAdminById(id) {
  if (!id || String(id) === 'env') return null;
  const { rows } = await pool.query('SELECT * FROM admin_users WHERE id = $1', [id]);
  return mapAdmin(rows[0]);
}

/**
 * Create the one admin account. The WHERE NOT EXISTS makes the "first admin only"
 * rule atomic: two simultaneous requests cannot both create an account.
 * @returns {Promise<{ ok: true, admin: object } | { ok: false, reason: string }>}
 */
export async function createFirstAdmin({ displayName, email, passwordHash }) {
  const id = crypto.randomUUID();

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_users (id, email, password_hash, display_name)
       SELECT $1::uuid, $2, $3, $4
       WHERE NOT EXISTS (SELECT 1 FROM admin_users)
       RETURNING *`,
      [id, normaliseEmail(email), passwordHash, String(displayName).trim()],
    );

    if (rows.length === 0) return { ok: false, reason: 'exists' };
    return { ok: true, admin: mapAdmin(rows[0]) };
  } catch (err) {
    // Unique violation on the case-insensitive email index.
    if (err.code === '23505') return { ok: false, reason: 'email_exists' };
    throw err;
  }
}

export async function recordAdminLogin(id) {
  if (!id || id === 'env') return;
  await pool.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [id]);
}

export async function updateAdminDisplayName(id, displayName) {
  const { rows } = await pool.query(
    'UPDATE admin_users SET display_name = $2 WHERE id = $1 RETURNING *',
    [id, String(displayName).trim()],
  );
  return mapAdmin(rows[0]);
}

/** Change a password and invalidate every older session for that admin. */
export async function updateAdminPassword(id, passwordHash) {
  const { rows } = await pool.query(
    `UPDATE admin_users
        SET password_hash = $2,
            password_changed_at = now(),
            session_version = session_version + 1
      WHERE id = $1
      RETURNING *`,
    [id, passwordHash],
  );
  return mapAdmin(rows[0]);
}

export async function readRecoveryEmails(adminId) {
  const { rows } = await pool.query(
    `SELECT id, email, verified_at, created_at
       FROM admin_recovery_emails
      WHERE admin_id = $1
      ORDER BY created_at ASC`,
    [adminId],
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    verified: Boolean(row.verified_at),
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  }));
}

/**
 * Add a pending recovery address and return the verification token to email.
 * @returns {Promise<{ ok: true, token: string, email: string } | { ok: false, error: string }>}
 */
export async function addRecoveryEmail(adminId, email) {
  const address = normaliseEmail(email);

  const primary = await pool.query('SELECT email FROM admin_users WHERE id = $1', [adminId]);
  if (normaliseEmail(primary.rows[0]?.email) === address) {
    return { ok: false, error: 'That is already your sign-in email.' };
  }

  const existing = await readRecoveryEmails(adminId);
  if (existing.length >= MAX_RECOVERY_EMAILS) {
    return { ok: false, error: `You can add up to ${MAX_RECOVERY_EMAILS} recovery emails.` };
  }

  const token = createOpaqueToken();
  const id = `are_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + RECOVERY_VERIFY_TTL_MS);

  try {
    await pool.query(
      `INSERT INTO admin_recovery_emails
         (id, admin_id, email, verify_token_hash, verify_expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, adminId, address, hashToken(token), expiresAt],
    );
  } catch (err) {
    if (err.code === '23505') {
      return { ok: false, error: 'That address is already a recovery email.' };
    }
    throw err;
  }

  return { ok: true, token, email: address, id };
}

/** Mark a recovery address verified. Returns the row, or null for a bad/expired token. */
export async function verifyRecoveryEmail(token) {
  const { rows } = await pool.query(
    `UPDATE admin_recovery_emails
        SET verified_at = now(),
            verify_token_hash = NULL,
            verify_expires_at = NULL
      WHERE verify_token_hash = $1
        AND verified_at IS NULL
        AND verify_expires_at > now()
      RETURNING id, admin_id, email, verified_at`,
    [hashToken(token)],
  );

  return rows[0] ?? null;
}

export async function deleteRecoveryEmail(adminId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM admin_recovery_emails WHERE id = $1 AND admin_id = $2',
    [id, adminId],
  );
  return rowCount > 0;
}

/**
 * Find the admin who owns a primary or verified recovery address.
 * Used only by forgot-password, which answers generically either way.
 */
export async function findAdminForPasswordReset(email) {
  const { rows } = await pool.query(
    `SELECT DISTINCT a.*
       FROM admin_users a
       LEFT JOIN admin_recovery_emails r
         ON r.admin_id = a.id AND r.verified_at IS NOT NULL
      WHERE lower(a.email) = lower($1)
         OR lower(r.email) = lower($1)
      LIMIT 1`,
    [normaliseEmail(email)],
  );
  return mapAdmin(rows[0]);
}

/** Every address that may receive a reset link: primary + verified recovery. */
export async function readResetRecipients(adminId) {
  const { rows } = await pool.query(
    `SELECT email FROM admin_users WHERE id = $1
     UNION
     SELECT email FROM admin_recovery_emails
      WHERE admin_id = $1 AND verified_at IS NOT NULL`,
    [adminId],
  );
  return rows.map((row) => row.email);
}

/** Create a one-time reset token and return it. Only its hash is stored. */
export async function createPasswordReset(adminId) {
  await pool.query(
    `DELETE FROM admin_password_resets
      WHERE admin_id = $1 AND (used_at IS NOT NULL OR expires_at < now())`,
    [adminId],
  );

  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await pool.query(
    `INSERT INTO admin_password_resets (id, admin_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [`apr_${crypto.randomUUID()}`, adminId, hashToken(token), expiresAt],
  );

  return token;
}

/**
 * Consume a reset token and set the new password in one transaction.
 * Every older token for that admin is invalidated, and session_version moves so
 * cookies issued before the reset stop working.
 *
 * @returns {Promise<object|null>} the updated admin, or null for a bad/expired token
 */
export async function resetAdminPassword(token, passwordHash) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const consumed = await client.query(
      `UPDATE admin_password_resets
          SET used_at = now()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING admin_id`,
      [hashToken(token)],
    );

    if (consumed.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const adminId = consumed.rows[0].admin_id;

    const updated = await client.query(
      `UPDATE admin_users
          SET password_hash = $2,
              password_changed_at = now(),
              session_version = session_version + 1
        WHERE id = $1
        RETURNING *`,
      [adminId, passwordHash],
    );

    await client.query(
      `UPDATE admin_password_resets
          SET used_at = now()
        WHERE admin_id = $1 AND used_at IS NULL`,
      [adminId],
    );

    await client.query('COMMIT');
    return mapAdmin(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { MAX_RECOVERY_EMAILS };
