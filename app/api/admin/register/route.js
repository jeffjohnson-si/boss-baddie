import { NextResponse } from 'next/server';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';
import {
  createFirstAdmin,
  displayNameProblems,
  hasAdmin,
  hashAdminPassword,
  isValidEmail,
  normaliseEmail,
  passwordProblems,
} from '@/lib/admin-store';
import { sendEmail } from '@/lib/email';
import { siteOrigin } from '@/lib/site-url';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/admin/register — create the one owner account.
 *
 * First-admin-only: createFirstAdmin() inserts with WHERE NOT EXISTS, so once a
 * row exists every later request is refused atomically. There is no public path
 * for a second admin.
 *
 * Body: { name, email, password, confirmPassword }
 */

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const gate = hit(`admin-register:${clientKey(request)}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  try {
    if (await hasAdmin()) {
      return NextResponse.json(
        { ok: false, error: 'An owner account already exists. Sign in instead.' },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error('[api/admin/register] could not check admin count:', err.message);
    return NextResponse.json(
      { ok: false, error: 'Registration is not available right now.' },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const displayName = String(body?.name ?? '').trim();
  const email = normaliseEmail(body?.email);
  const password = String(body?.password ?? '');
  const confirmPassword = String(body?.confirmPassword ?? '');

  const errors = [
    ...displayNameProblems(displayName),
    ...(isValidEmail(email) ? [] : ['Enter a valid email address.']),
    ...passwordProblems(password, email),
  ];
  if (password !== confirmPassword) errors.push('The passwords do not match.');

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  let result;
  try {
    result = await createFirstAdmin({
      displayName,
      email,
      passwordHash: hashAdminPassword(password),
    });
  } catch (err) {
    console.error('[api/admin/register] could not create the admin:', err.message);
    return NextResponse.json(
      { ok: false, error: 'Could not create the account. Try again.' },
      { status: 500 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.reason === 'email_exists'
            ? 'That email is already in use.'
            : 'An owner account already exists. Sign in instead.',
      },
      { status: 409 },
    );
  }

  const origin = siteOrigin(request);
  // Best effort: a failed welcome email must not undo a created account.
  await sendEmail({
    to: result.admin.email,
    subject: 'Your BOSS BADDIE owner account is ready',
    text:
      `Your owner account for BOSS BADDIE is ready.\n\n` +
      `Sign in: ${origin}/admin/login\n\n` +
      `If you ever forget the password, use the "Forgot password" link on that page.`,
    html:
      `<p>Your owner account for <strong>BOSS BADDIE</strong> is ready.</p>` +
      `<p><a href="${origin}/admin/login">Sign in to the dashboard</a></p>` +
      `<p>If you ever forget the password, use the “Forgot password” link on that page.</p>`,
  });

  let token;
  try {
    token = createSessionToken(result.admin);
  } catch (err) {
    console.error('[api/admin/register] session secret missing:', err.message);
    return NextResponse.json(
      { ok: false, error: 'The account was created, but sign-in is not configured. Use the login page.' },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
