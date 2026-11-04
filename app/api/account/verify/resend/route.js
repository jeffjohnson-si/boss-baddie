import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/customers';
import {
  consumeVerification,
  hasPending,
  resendCooldownSeconds,
  restartVerification,
  VERIFICATION_RULES,
} from '@/lib/verification';
import { isEmailConfigured, sendVerificationCode } from '@/lib/email';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/account/verify/resend — another code, same pending sign-up.
 *
 * The details are not asked for again: the pending row already holds them, so this
 * only replaces the code and the expiry. Cooldown is enforced here as well as in
 * the register route, because this is the endpoint a script would call in a loop.
 *
 * Body: { email }
 */

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const gate = hit(`customer-verify-resend:${clientKey(request)}`, {
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many codes requested. Try again later.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  if (!isEmailConfigured()) {
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
    return NextResponse.json({ ok: false, errors: ['Invalid email address.'] }, { status: 422 });
  }

  const wait = await resendCooldownSeconds(email);
  if (wait > 0) {
    return NextResponse.json(
      { ok: false, errors: [`Wait ${wait} seconds before asking for another code.`] },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }

  if (!(await hasPending(email))) {
    return NextResponse.json(
      { ok: false, errors: ['There is no sign-up waiting for that email. Start again.'] },
      { status: 404 },
    );
  }

  const code = await restartVerification(email);
  if (!code) {
    return NextResponse.json(
      { ok: false, errors: ['There is no sign-up waiting for that email. Start again.'] },
      { status: 404 },
    );
  }

  const sent = await sendVerificationCode({ to: email, code, purpose: 'signup' });
  if (!sent.ok) {
    await consumeVerification(email);
    console.error('[api/account/verify/resend] email failed:', sent.error);
    return NextResponse.json(
      { ok: false, errors: ['We could not send the email. Start again.'] },
      { status: 502 },
    );
  }

  const payload = {
    ok: true,
    expiresIn: VERIFICATION_RULES.TTL_MINUTES * 60,
    resendAfter: VERIFICATION_RULES.RESEND_COOLDOWN_SECONDS,
  };

  // LOCAL TESTING ONLY — see the same note in the register route.
  if (process.env.EMAIL_DEV_SHOW_CODE === '1') payload.devCode = code;

  return NextResponse.json(payload);
}
