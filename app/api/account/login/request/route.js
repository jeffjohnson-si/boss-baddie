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
 * If the address has an account, a six-digit code is emailed. If it does not, the
 * request is refused outright with `needsAccount`, and the page offers sign-up.
 *
 * THAT IS A DELIBERATE TRADE. The usual choice is to answer identically for every
 * address so the endpoint cannot be used to discover who shops here. This one
 * answers honestly instead: a new customer who types her address into the sign-in
 * form was being told "a code is on its way" and then waiting forever for an email
 * that was never sent. Clarity was chosen over concealment.
 *
 * What still holds: the per-address limit counts every address, real or not, and
 * a code is only ever generated for an account that exists.
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

  // No account: say so, and let the page offer sign-up. Nothing is generated and
  // nothing is sent.
  if (!(await emailTaken(email))) {
    return NextResponse.json(
      {
        ok: false,
        needsAccount: true,
        email,
        errors: ['That email is not registered yet. Create an account to get started.'],
      },
      { status: 404 },
    );
  }

  const payload = {
    ok: true,
    pending: true,
    email,
    expiresIn: VERIFICATION_RULES.TTL_MINUTES * 60,
    resendAfter: VERIFICATION_RULES.RESEND_COOLDOWN_SECONDS,
  };

  // A second request inside the cooldown answers the same and sends nothing, so
  // pressing "send again" twice does not fire two emails.
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
