import { NextResponse } from 'next/server';
import { isCustomerAuthConfigured } from '@/lib/customer-auth';
import { formatPhone, normalizePhone, phoneTaken } from '@/lib/customers';
import {
  consumeLoginCode,
  resendLoginCooldownSeconds,
  startLoginVerification,
} from '@/lib/login-verification';
import { VERIFICATION_RULES } from '@/lib/verification';
import { isSmsConfigured, sendVerificationSms, smsProvider } from '@/lib/sms';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/login/request — step one of passwordless sign-in.
 *
 * Body: { phone }
 *
 * If the number has an account, a six-digit code is texted. The response is the
 * same whether or not the account exists, so this endpoint cannot be used to
 * enumerate Patricia's customers.
 */

const IP_LIMIT = 10;
const IP_WINDOW_MS = 15 * 60 * 1000;
const PHONE_LIMIT = 5;
const PHONE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const ipGate = hit(`customer-login-request-ip:${clientKey(request)}`, {
    limit: IP_LIMIT,
    windowMs: IP_WINDOW_MS,
  });
  if (!ipGate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many code requests. Try again later.'] },
      { status: 429, headers: { 'Retry-After': String(ipGate.retryAfter) } },
    );
  }

  if (!isCustomerAuthConfigured()) {
    return NextResponse.json(
      { ok: false, errors: ['Accounts are not configured on the server yet.'] },
      { status: 503 },
    );
  }

  if (!isSmsConfigured()) {
    console.error(`[api/account/login/request] SMS is not configured (provider: ${smsProvider()}).`);
    return NextResponse.json(
      { ok: false, errors: ['Text messages are not set up on this server yet.'] },
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
      { ok: false, errors: ['Enter the phone number on your account.'] },
      { status: 422 },
    );
  }

  const phoneGate = hit(`customer-login-request-phone:${phone}`, {
    limit: PHONE_LIMIT,
    windowMs: PHONE_WINDOW_MS,
  });
  if (!phoneGate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many codes for that number. Try again later.'] },
      { status: 429, headers: { 'Retry-After': String(phoneGate.retryAfter) } },
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

  // No account: answer exactly the same way, but send nothing.
  if (!(await phoneTaken(phone))) return NextResponse.json(payload);

  const wait = await resendLoginCooldownSeconds(phone);
  if (wait > 0) {
    return NextResponse.json(
      { ok: false, errors: [`Wait ${wait} seconds before asking for another code.`] },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }

  const code = await startLoginVerification(phone);
  const sent = await sendVerificationSms(phone, code);
  if (!sent.ok) {
    await consumeLoginCode(phone);
    console.error('[api/account/login/request] SMS failed:', sent.error);
    return NextResponse.json(
      { ok: false, errors: ['We could not send the text message. Check the number and try again.'] },
      { status: 502 },
    );
  }

  // LOCAL TESTING ONLY — see the note in the register route.
  if (process.env.SMS_DEV_SHOW_CODE === '1') payload.devCode = code;

  return NextResponse.json(payload);
}
