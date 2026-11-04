import { NextResponse } from 'next/server';
import { isCustomerAuthConfigured } from '@/lib/customer-auth';
import { emailTaken, validateSignup } from '@/lib/customers';
import {
  consumeVerification,
  resendCooldownSeconds,
  startVerification,
  VERIFICATION_RULES,
} from '@/lib/verification';
import { emailProvider, isEmailConfigured, sendVerificationCode } from '@/lib/email';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/register — step one of two.
 *
 * Nothing is created here. The form is validated, a pending verification row is
 * stored and a six-digit code is emailed to the address. The account only exists
 * once /api/account/verify accepts that code. There is no password.
 *
 * That ordering is what makes "you must receive the email" true rather than
 * decorative: an unverified sign-up cannot sign in, cannot order, and does not
 * occupy the address.
 *
 * RATE LIMITED twice over: five sign-ups per address per hour, and a 60-second
 * cooldown per email so the endpoint cannot be used to bomb an inbox (or run up
 * a Brevo bill).
 *
 * Body: { name, email, phone, location }
 */

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const gate = hit(`customer-register:${clientKey(request)}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many sign-ups from here. Try again later.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  if (!isCustomerAuthConfigured()) {
    console.error('[api/account/register] CUSTOMER_SESSION_SECRET is missing or too short.');
    return NextResponse.json(
      { ok: false, errors: ['Accounts are not configured on the server yet.'] },
      { status: 503 },
    );
  }

  if (!isEmailConfigured()) {
    console.error(`[api/account/register] Email is not configured (provider: ${emailProvider()}).`);
    return NextResponse.json(
      { ok: false, errors: ['Email is not set up on this server yet, so accounts cannot be created.'] },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const check = validateSignup(body);
  if (!check.ok) {
    return NextResponse.json({ ok: false, errors: check.errors }, { status: 422 });
  }

  const { email, name, phone, location } = check.values;

  if (await emailTaken(email)) {
    return NextResponse.json(
      { ok: false, errors: ['That email already has an account. Sign in instead.'] },
      { status: 422 },
    );
  }

  const wait = await resendCooldownSeconds(email);
  if (wait > 0) {
    return NextResponse.json(
      { ok: false, errors: ['A code was just sent. Wait a moment before asking for another.'] },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }

  const code = await startVerification({ email, name, phone, location });

  const sent = await sendVerificationCode({ to: email, code, purpose: 'signup' });
  if (!sent.ok) {
    // No half-finished sign-up left behind if the provider refuses the message.
    await consumeVerification(email);
    console.error('[api/account/register] email failed:', sent.error);
    return NextResponse.json(
      { ok: false, errors: ['We could not send the email. Check the address and try again.'] },
      { status: 502 },
    );
  }

  const payload = {
    ok: true,
    pending: true,
    email,
    expiresIn: VERIFICATION_RULES.TTL_MINUTES * 60,
    resendAfter: VERIFICATION_RULES.RESEND_COOLDOWN_SECONDS,
  };

  // LOCAL TESTING ONLY. Without this flag a code is never in a response, which is
  // why EMAIL_DEV_SHOW_CODE must stay unset in production.
  if (process.env.EMAIL_DEV_SHOW_CODE === '1') payload.devCode = code;

  return NextResponse.json(payload, { status: 201 });
}
