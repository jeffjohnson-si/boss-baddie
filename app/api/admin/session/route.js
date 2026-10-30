import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyCredentials,
} from '@/lib/auth';
import {
  countAdmins,
  getAdminByEmail,
  normaliseEmail,
  recordAdminLogin,
  verifyAdminPassword,
} from '@/lib/admin-store';
import { clientKey, hit, reset } from '@/lib/rate-limit';

/**
 * Admin session endpoint.
 *
 *   POST   /api/admin/session   log in  — sets the signed session cookie
 *   DELETE /api/admin/session   log out — clears it
 *
 * Once admin_users has a row, the database account is the only way in. The
 * ADMIN_EMAIL / ADMIN_PASSWORD pair is a bootstrap for the very first sign-in and
 * stops working the moment Patricia registers.
 *
 * RATE LIMITED: ten wrong answers from one address in fifteen minutes.
 */

const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request) {
  const key = `admin-login:${clientKey(request)}`;
  const gate = hit(key, { limit: LIMIT, windowMs: WINDOW_MS });

  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim();
  const password = String(body?.password ?? '');

  let admin = null;

  try {
    const admins = await countAdmins();

    if (admins > 0) {
      const found = await getAdminByEmail(normaliseEmail(email));
      if (found && verifyAdminPassword(found, password)) admin = found;
    } else if (verifyCredentials(email, password)) {
      // First-run bootstrap. There is no database account to attach a name to.
      admin = {
        id: 'env',
        email: normaliseEmail(email),
        displayName: 'Patricia',
        sessionVersion: 0,
      };
    }
  } catch (err) {
    console.error('[api/admin/session] could not read the admin account:', err.message);
    return NextResponse.json(
      { ok: false, error: 'Sign-in is not available right now.' },
      { status: 500 },
    );
  }

  if (!admin) {
    // Deliberately vague: never reveal whether it was the email or the password
    // that was wrong, and never reveal whether an account exists.
    return NextResponse.json({ ok: false, error: 'Those details do not match.' }, { status: 401 });
  }

  let token;
  try {
    token = createSessionToken(admin);
  } catch (err) {
    console.error('[api/admin/session]', err.message);
    return NextResponse.json(
      { ok: false, error: 'Login is not configured on the server yet.' },
      { status: 500 },
    );
  }

  if (admin.id !== 'env') {
    await recordAdminLogin(admin.id).catch((err) => {
      // A failed last_login_at update must not block a valid sign-in.
      console.error('[api/admin/session] could not record login:', err.message);
    });
  }

  reset(key);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
