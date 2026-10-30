import { NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  createCustomerToken,
  customerCookieOptions,
  isCustomerAuthConfigured,
  isSecureRequest,
} from '@/lib/customer-auth';
import { verifyCustomerLogin } from '@/lib/customers';
import { clientKey, hit, reset } from '@/lib/rate-limit';

/**
 * POST   /api/account/session — sign in with phone + password.
 * DELETE /api/account/session — sign out.
 *
 * Fifteen wrong attempts per address per fifteen minutes, cleared on a success so
 * a fumbled password cannot lock a customer out of her own account.
 *
 * The failure message is deliberately identical for "no such number" and "wrong
 * password": telling them apart would let anyone check whether a given number
 * shops here.
 */

const LIMIT = 15;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request) {
  const key = `customer-login:${clientKey(request)}`;
  const gate = hit(key, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many sign-in attempts. Please wait a few minutes.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  if (!isCustomerAuthConfigured()) {
    console.error('[api/account/session] CUSTOMER_SESSION_SECRET is missing or too short.');
    return NextResponse.json(
      { ok: false, errors: ['Accounts are not configured on the server yet.'] },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const customer = await verifyCustomerLogin(body?.phone, body?.password);
  if (!customer) {
    return NextResponse.json(
      { ok: false, errors: ['Those details do not match. Check your number and password.'] },
      { status: 401 },
    );
  }

  reset(key);

  const response = NextResponse.json({ ok: true, customer });
  response.cookies.set(
    CUSTOMER_COOKIE,
    createCustomerToken(customer.id, customer.sessionVersion),
    customerCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}

export async function DELETE(request) {
  const response = NextResponse.json({ ok: true });
  // Same attributes as when it was set, or some browsers keep the old cookie.
  response.cookies.set(CUSTOMER_COOKIE, '', {
    ...customerCookieOptions({ secure: isSecureRequest(request) }),
    maxAge: 0,
  });
  return response;
}
