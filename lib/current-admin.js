import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { countAdmins, getAdminById } from '@/lib/admin-store';

/**
 * Who is signed in to the admin, on the server.
 *
 * This is the only place an admin session is accepted. It checks the signature
 * AND the row: the cookie's `sv` must still match admin_users.session_version, so
 * a password reset invalidates older cookies immediately.
 *
 * The environment login (sub = 'env') is a bootstrap. It works while no database
 * admin exists, and on a local preview where DEV_LOGIN_ENABLED=1. In production,
 * once Patricia has registered, an env session is refused.
 *
 * @returns {Promise<null | { id: string, email: string, displayName: string,
 *   sessionVersion: number, isEnv?: boolean, passwordHash?: string }>}
 */
export async function currentAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  if (payload.sub === 'env') {
    if (process.env.DEV_LOGIN_ENABLED === '1') {
      return {
        id: 'env',
        email: payload.email || 'dev@localhost',
        displayName: 'Patricia',
        sessionVersion: 0,
        isEnv: true,
      };
    }

    try {
      if ((await countAdmins()) > 0) return null;
    } catch (err) {
      console.error('[current-admin] could not check the admin count:', err.message);
      return null;
    }

    return {
      id: 'env',
      email: payload.email || 'bootstrap',
      displayName: 'Patricia',
      sessionVersion: 0,
      isEnv: true,
    };
  }

  try {
    const admin = await getAdminById(payload.sub);
    if (!admin) return null;
    if (Number(payload.sv) !== Number(admin.sessionVersion)) return null;
    return admin;
  } catch (err) {
    console.error('[current-admin] could not read the admin:', err.message);
    return null;
  }
}

/** Boolean helper for routes that only need "is this admin signed in". */
export async function isAdminSignedIn() {
  return Boolean(await currentAdmin());
}
