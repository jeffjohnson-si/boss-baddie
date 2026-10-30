import { NextResponse } from 'next/server';
import { hashPassword, isCustomerAuthConfigured } from '@/lib/customer-auth';
import { formatPhone, phoneTaken, validateSignup } from '@/lib/customers';
import {
  consumeVerification,
  resendCooldownSeconds,
  startVerification,
  VERIFICATION_RULES,
} from '@/lib/verification';
import { isSmsConfigured, sendVerificationSms, smsProvider } from '@/lib/sms';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/register — step one of two.
 *
 * Nothing is created here. The form is validated, the password is hashed, a pending
 * verification row is stored and a six-digit code is texted to the number. The
 * account only exists once /api/account/verify accepts that code.
 *
 * That ordering is what makes "you must receive the SMS" true rather than
 * decorative: an unverified sign-up cannot sign in, cannot order, and does not
 * occupy the phone number.
 *
 * RATE LIMITED twice over: five sign-ups per address per hour, and a 60-second
 * cooldown per number so the endpoint cannot be used to bomb a phone (or run up an
 * SMS bill).
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

  if (!isSmsConfigured()) {
    console.error(`[api/account/register] SMS is not configured (provider: ${smsProvider()}).`);
    return NextResponse.json(
      { ok: false, errors: ['Text messages are not set up on this server yet, so accounts cannot be created.'] },
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

  const { phone, name, location, email, password } = check.values;

  if (await phoneTaken(phone)) {
    return NextResponse.json(
      { ok: false, errors: ['That number already has an account. Sign in instead.'] },
      { status: 422 },
    );
  }

  const wait = await resendCooldownSeconds(phone);
  if (wait > 0) {
    return NextResponse.json(
      { ok: false, errors: ['A code was just sent. Wait a moment before asking for another.'] },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }

  // Hashed before the code is sent: the plain password never leaves this request.
  const passwordHash = hashPassword(password);
  const code = await startVerification({ phone, name, location, email, passwordHash });

  const sent = await sendVerificationSms(phone, code);
  if (!sent.ok) {
    // No half-finished sign-up left behind if the provider refuses the message.
    await consumeVerification(phone);
    console.error('[api/account/register] SMS failed:', sent.error);
    return NextResponse.json(
      { ok: false, errors: ['We could not send the text message. Check the number and try again.'] },
      { status: 502 },
    );
  }

  const payload = {
    ok: true,
    pending: true,
    phone,
    phoneDisplay: formatPhone(phone),
    expiresIn: VERIFICATION_RULES.TTL_MINUTES * 60,
    resendAfter: VERIFICATION_RULES.RESEND_COOLDOWN_SECONDS,
  };

  // LOCAL TESTING ONLY. Without this flag a code is never in a response, which is
  // why SMS_DEV_SHOW_CODE must stay unset in production.
  if (process.env.SMS_DEV_SHOW_CODE === '1') payload.devCode = code;

  return NextResponse.json(payload, { status: 201 });
}
