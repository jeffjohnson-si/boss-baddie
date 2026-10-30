import { NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  createCustomerToken,
  customerCookieOptions,
  isCustomerAuthConfigured,
  isSecureRequest,
} from '@/lib/customer-auth';
import { createCustomer, normalizePhone, phoneTaken } from '@/lib/customers';
import { checkCode, consumeVerification } from '@/lib/verification';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/verify — step two: the code that was texted.
 *
 * On success the customer row is created and she is signed in, so signing up is
 * still one sitting. On failure the reason is deliberately specific about the code
 * (wrong, expired, too many) because there is nothing to enumerate: the caller
 * already knows which number they are verifying.
 */

const LIMIT = 15;
const WINDOW_MS = 15 * 60 * 1000;

const MESSAGES = {
  missing: 'There is no sign-up waiting for that number. Start again.',
  expired: 'That code has expired. Start again to get a new one.',
  too_many: 'Too many wrong codes. Start again to get a new one.',
};

export async function POST(request) {
  const gate = hit(`customer-verify:${clientKey(request)}`, { limit: LIMIT, windowMs: WINDOW_MS });
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
      { ok: false, errors: ['Enter the number you signed up with.'] },
      { status: 422 },
    );
  }

  const result = await checkCode(phone, body?.code);
  if (!result.ok) {
    const message =
      result.reason === 'wrong'
        ? `That code is not right.${
            Number.isFinite(result.attemptsLeft) ? ` ${result.attemptsLeft} tries left.` : ''
          }`
        : MESSAGES[result.reason] ?? 'That code could not be checked. Try again.';

    return NextResponse.json({ ok: false, errors: [message] }, { status: 422 });
  }

  // Someone else may have completed this number between the two steps.
  if (await phoneTaken(phone)) {
    await consumeVerification(phone);
    return NextResponse.json(
      { ok: false, errors: ['That number already has an account. Sign in instead.'] },
      { status: 409 },
    );
  }

  const created = await createCustomer({
    phone,
    name: result.pending.name,
    location: result.pending.location,
    email: result.pending.email,
    passwordHash: result.pending.password_hash,
  });

  if (!created.ok) {
    return NextResponse.json({ ok: false, errors: created.errors }, { status: 422 });
  }

  await consumeVerification(phone);

  const response = NextResponse.json({ ok: true, customer: created.customer }, { status: 201 });
  response.cookies.set(
    CUSTOMER_COOKIE,
    createCustomerToken(created.customer.id, created.customer.sessionVersion),
    customerCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}
