import { NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  createCustomerToken,
  customerCookieOptions,
  isSecureRequest,
} from '@/lib/customer-auth';
import { createCustomer } from '@/lib/customers';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dev/login?next=/shop — DEVELOPMENT ONLY.
 *
 * Signs the browser in as a preview customer with no password and no emailed code, so the
 * pages behind the gate can be reviewed while the app is still being built.
 *
 * IT REFUSES TO RUN unless DEV_LOGIN_ENABLED=1 is set in the environment. That
 * flag belongs in .env.local and nowhere else: with it, anyone who knows the URL
 * becomes a customer. It is not `NODE_ENV`-gated because a local preview runs the
 * production build (`next start`) in order to exercise the service worker — an
 * explicit, easy-to-audit opt-in is the honest switch here.
 *
 * The account is created on first use if it does not exist, so the shortcut works
 * on a fresh database.
 */

const PREVIEW_PHONE = process.env.DEV_LOGIN_PHONE || '7412345';
const PREVIEW_EMAIL = 'preview@bossbaddie.test';
const PREVIEW_NAME = 'Preview Customer';

export async function GET(request) {
  if (process.env.DEV_LOGIN_ENABLED !== '1') {
    // The same answer a missing route gives: nothing hints that this exists.
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get('next') || '/account';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/account';

  const { rows } = await pool.query(
    'SELECT id, session_version FROM customers WHERE lower(email) = $1',
    [PREVIEW_EMAIL],
  );
  let customerId = rows[0]?.id;
  let sessionVersion = rows[0]?.session_version ?? 0;

  if (!customerId) {
    const created = await createCustomer({
      email: PREVIEW_EMAIL,
      phone: PREVIEW_PHONE,
      name: PREVIEW_NAME,
      location: 'Honiara',
    });

    if (!created.ok) {
      return NextResponse.json({ ok: false, errors: created.errors }, { status: 500 });
    }
    customerId = created.customer.id;
    sessionVersion = created.customer.sessionVersion ?? 0;
  }

  console.log(`[dev-login] signed in as ${PREVIEW_PHONE} -> ${next}`);

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(
    CUSTOMER_COOKIE,
    createCustomerToken(customerId, sessionVersion),
    customerCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}
