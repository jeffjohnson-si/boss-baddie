import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import {
  hashAdminPassword,
  passwordProblems,
  updateAdminPassword,
  verifyAdminPassword,
} from '@/lib/admin-store';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';
import { hit } from '@/lib/rate-limit';

/**
 * PATCH /api/admin/account/password — change the password from inside the account.
 *
 * The current password is required, and the new password increments
 * session_version. The response sets a fresh cookie for this browser; every other
 * signed-in device is signed out at its next request.
 */

const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function PATCH(request) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }
  if (admin.id === 'env') {
    return NextResponse.json(
      { ok: false, errors: ['Create the owner account before changing its password.'] },
      { status: 403 },
    );
  }

  const gate = hit(`admin-password:${admin.id}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many attempts. Wait a few minutes.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const currentPassword = String(body?.currentPassword ?? '');
  const nextPassword = String(body?.nextPassword ?? '');
  const confirmPassword = String(body?.confirmPassword ?? '');

  if (!verifyAdminPassword(admin, currentPassword)) {
    return NextResponse.json(
      { ok: false, errors: ['The current password is not correct.'] },
      { status: 422 },
    );
  }

  const errors = passwordProblems(nextPassword, admin.email);
  if (nextPassword !== confirmPassword) errors.push('The new passwords do not match.');
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const updated = await updateAdminPassword(admin.id, hashAdminPassword(nextPassword));
  if (!updated) {
    return NextResponse.json({ ok: false, errors: ['Account not found.'] }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(updated), sessionCookieOptions());
  return response;
}
