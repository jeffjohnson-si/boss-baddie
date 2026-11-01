import { NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  createCustomerToken,
  customerCookieOptions,
  isCustomerAuthConfigured,
  isSecureRequest,
} from '@/lib/customer-auth';
import { getCustomerByPhone, normalizePhone, recordCustomerLogin } from '@/lib/customers';
import { checkLoginCode } from '@/lib/login-verification';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/login/verify — step two of passwordless sign-in.
 *
 * Body: { phone, code }
 *
 * On success the old code is consumed and a 400-day session cookie is issued.
 */

const LIMIT = 15;
const WINDOW_MS = 15 * 60 * 1000;

const MESSAGES = {
  missing: 'There is no code waiting for that number. Request a new one.',
  expired: 'That code has expired. Request a new one.',
  too_many: 'Too many wrong codes. Request a new one.',
};

export async function POST(request) {
  const gate = hit(`customer-login-verify:${clientKey(request)}`, {
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many attempts. Please wait a few minutes.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  if (!isCustomerAuthConfigured()) {
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

  const phone = normalizePhone(body?.phone);
  if (!phone) {
    return NextResponse.json(
      { ok: false, errors: ['Enter the number you requested a code for.'] },
      { status: 422 },
    );
  }

  const result = await checkLoginCode(phone, body?.code);
  if (!result.ok) {
    const message =
      result.reason === 'wrong'
        ? `That code is not right.${
            Number.isFinite(result.attemptsLeft) ? ` ${result.attemptsLeft} tries left.` : ''
          }`
        : MESSAGES[result.reason] ?? 'That code could not be checked. Try again.';

    return NextResponse.json({ ok: false, errors: [message] }, { status: 422 });
  }

  const customer = await getCustomerByPhone(phone);
  if (!customer) {
    return NextResponse.json(
      { ok: false, errors: ['That number no longer has an account.'] },
      { status: 404 },
    );
  }

  await recordCustomerLogin(customer.id);

  const response = NextResponse.json({ ok: true, customer });
  response.cookies.set(
    CUSTOMER_COOKIE,
    createCustomerToken(customer.id, customer.sessionVersion),
    customerCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}
