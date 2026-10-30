import { NextResponse } from 'next/server';
import { currentCustomer } from '@/lib/current-customer';
import { changeCustomerPassword } from '@/lib/customers';
import {
  CUSTOMER_COOKIE,
  createCustomerToken,
  customerCookieOptions,
  isSecureRequest,
} from '@/lib/customer-auth';
import { hit } from '@/lib/rate-limit';

/**
 * PATCH /api/account/password — change the password, behind the current one.
 *
 * Ten attempts per account per fifteen minutes. The limit is keyed on the customer
 * id rather than the address, because the thing being guessed is one account's
 * password; a shared phone on a shared connection should not be able to lock a
 * whole household out by fumbling.
 */

const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function PATCH(request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }

  const gate = hit(`customer-password:${customer.id}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many attempts. Please wait a few minutes.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const result = await changeCustomerPassword(customer.id, body?.currentPassword, body?.nextPassword);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  const response = NextResponse.json({ ok: true });

  // The password change incremented session_version, so this browser needs the
  // fresh cookie; every other device now fails at its next request.
  if (result.customer) {
    response.cookies.set(
      CUSTOMER_COOKIE,
      createCustomerToken(result.customer.id, result.customer.sessionVersion),
      customerCookieOptions({ secure: isSecureRequest(request) }),
    );
  }

  return response;
}
