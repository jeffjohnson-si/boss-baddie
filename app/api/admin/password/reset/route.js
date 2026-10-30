import { NextResponse } from 'next/server';
import {
  hashAdminPassword,
  passwordProblems,
  resetAdminPassword,
} from '@/lib/admin-store';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/admin/password/reset — consume a one-time link and set a new password.
 *
 * The store does the token check and the password update in one transaction, so a
 * token cannot be used twice and a failure halfway cannot leave the password
 * unchanged with the link spent.
 *
 * Body: { token, password, confirmPassword }
 */

const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request) {
  const gate = hit(`admin-reset:${clientKey(request)}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const token = String(body?.token ?? '');
  const password = String(body?.password ?? '');
  const confirmPassword = String(body?.confirmPassword ?? '');

  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'This reset link is missing its token.' },
      { status: 422 },
    );
  }

  const errors = passwordProblems(password);
  if (password !== confirmPassword) errors.push('The passwords do not match.');
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  let admin;
  try {
    admin = await resetAdminPassword(token, hashAdminPassword(password));
  } catch (err) {
    console.error('[api/admin/password/reset]', err.message);
    return NextResponse.json(
      { ok: false, error: 'Could not reset the password. Try again.' },
      { status: 500 },
    );
  }

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'This reset link is invalid, used, or has expired.' },
      { status: 422 },
    );
  }

  let session;
  try {
    session = createSessionToken(admin);
  } catch (err) {
    console.error('[api/admin/password/reset] session secret missing:', err.message);
    return NextResponse.json(
      { ok: false, error: 'Password changed. Please sign in on the login page.' },
      { status: 200 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return response;
}
