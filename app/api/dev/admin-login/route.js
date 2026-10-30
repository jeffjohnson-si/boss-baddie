import { NextResponse } from 'next/server';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';
import { getFirstAdmin } from '@/lib/admin-store';
import { isSecureRequest } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dev/admin-login?next=/admin — DEVELOPMENT ONLY.
 *
 * Issues an admin session without the password, so the dashboard can be reviewed
 * while the app is being built. It is gated on the same DEV_LOGIN_ENABLED flag as
 * the customer shortcut, and returns a plain 404 when the flag is absent — there is
 * no hint that the route exists.
 *
 * The session is a real one (same signing, same 12-hour expiry), so every admin
 * page and every admin API behaves exactly as it will for Patricia.
 */
export async function GET(request) {
  if (process.env.DEV_LOGIN_ENABLED !== '1') {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get('next') || '/admin';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/admin';

  console.log(`[dev-login] admin session issued -> ${next}`);

  // Use the real owner account when one exists, so local previews exercise the
  // same session-version check as production. Before registration, use env.
  const admin = await getFirstAdmin();
  const session = admin
    ? { id: admin.id, email: admin.email, sessionVersion: admin.sessionVersion }
    : { id: 'env', email: 'dev@localhost', sessionVersion: 0 };

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSessionToken(session), {
    ...sessionCookieOptions(),
    // Same reasoning as the customer cookie: follow the request, so a local
    // preview over http://localhost works while a deployed HTTPS site still gets
    // a Secure cookie.
    secure: isSecureRequest(request),
  });
  return response;
}
