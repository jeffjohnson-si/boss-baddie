import { NextResponse } from 'next/server';
import { isCustomerAuthConfigured } from '@/lib/customer-auth';
import { emailTaken, normalizeEmail } from '@/lib/customers';
import {
  consumeLoginCode,
  resendLoginCooldownSeconds,
  startLoginVerification,
} from '@/lib/login-verification';
import { VERIFICATION_RULES } from '@/lib/verification';
import { emailProvider, isEmailConfigured, sendVerificationCode } from '@/lib/email';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/login/request — step one of passwordless sign-in.
 *
 * Body: { email }
 *
 * If the address has an account, a six-digit code is emailed. The response is
 * identical whether or not the account exists, so this endpoint cannot be used
 * to enumerate Patricia's customers — including when the per-address limit is
 * reached, which is why that limit is counted in memory for every address rather
 * than only for real accounts.
 */

const IP_LIMIT = 10;
const IP_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 5;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;

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

  if (!isEmailConfigured()) {
    console.error(`[api/account/login/request] Email is not configured (provider: ${emailProvider()}).`);
    return NextResponse.json(
      { ok: false, errors: ['Email is not set up on this server yet.'] },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, errors: ['Enter the email address on your account.'] },
      { status: 422 },
    );
  }

  const emailGate = hit(`customer-login-request-email:${email}`, {
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailGate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many codes for that email. Try again later.'] },
      { status: 429, headers: { 'Retry-After': String(emailGate.retryAfter) } },
    );
  }

  const payload = {
    ok: true,
    pending: true,
    email,
    expiresIn: VERIFICATION_RULES.TTL_MINUTES * 60,
    resendAfter: VERIFICATION_RULES.RESEND_COOLDOWN_SECONDS,
  };

  // No account: answer exactly the same way, but send nothing.
  if (!(await emailTaken(email))) return NextResponse.json(payload);

  // A second request inside the cooldown answers the same and sends nothing, so
  // pressing "send again" twice does not read as a different kind of address.
  if ((await resendLoginCooldownSeconds(email)) > 0) return NextResponse.json(payload);

  const code = await startLoginVerification(email);
  const sent = await sendVerificationCode({ to: email, code, purpose: 'login' });
  if (!sent.ok) {
    await consumeLoginCode(email);
    console.error('[api/account/login/request] email failed:', sent.error);
    return NextResponse.json(
      { ok: false, errors: ['We could not send the email. Check the address and try again.'] },
      { status: 502 },
    );
  }

  // LOCAL TESTING ONLY — see the note in the register route.
  if (process.env.EMAIL_DEV_SHOW_CODE === '1') payload.devCode = code;

  return NextResponse.json(payload);
}
