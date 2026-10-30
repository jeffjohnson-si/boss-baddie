import { NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  createCustomerToken,
  customerCookieOptions,
  isSecureRequest,
} from '@/lib/customer-auth';
import { currentCustomer } from '@/lib/current-customer';
import { hit } from '@/lib/rate-limit';

/**
 * POST /api/account/session/refresh — slide the session forward.
 *
 * A cookie expiry is a fixed date, so "signed in until I log out" needs somebody to
 * move that date forward while she keeps using the app. components/SessionKeeper.js
 * calls this at most once a day; the server issues a fresh 400-day cookie, and the
 * app stays signed in for as long as she comes back.
 *
 * No new session is created and no identity is re-checked beyond the ordinary one:
 * if the cookie is missing, expired or revoked, this answers 401 and the browser
 * simply stays signed out.
 */
export async function POST(request) {
  const gate = hit(`customer-refresh:${request.headers.get('x-forwarded-for') ?? 'local'}`, {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!gate.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ ok: false, signedIn: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, signedIn: true });
  response.cookies.set(
    CUSTOMER_COOKIE,
    createCustomerToken(customer.id, customer.sessionVersion),
    customerCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}
