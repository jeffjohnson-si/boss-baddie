import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { isSmsConfigured, sendSms, smsProvider, toE164 } from '@/lib/sms';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/admin/sms-test — send one test text, as Patricia.
 *
 * WHAT IT IS FOR: proving the Twilio credentials before anyone tries to sign up.
 * Without it, the first real check of a new provider is a customer's sign-up, and
 * a failure there looks like the shop is broken rather than misconfigured.
 *
 * Admin session required, and rate limited: this endpoint spends money.
 *
 * Body: { to: "+677 7xxxxxx" } — any format; it is normalised to E.164 here.
 */

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  const gate = hit(`sms-test:${clientKey(request)}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many test messages. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const to = toE164(body?.to);
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Give a phone number to text.' }, { status: 422 });
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        provider: smsProvider(),
        error: 'SMS is not configured on this server. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID).',
      },
      { status: 503 },
    );
  }

  const result = await sendSms(
    to,
    'BOSS BADDIE test message. If you received this, sign-in codes will work.',
  );

  return NextResponse.json(
    {
      ok: result.ok,
      provider: smsProvider(),
      to,
      id: result.id ?? null,
      error: result.error ?? null,
      hint: result.hint ?? null,
      code: result.code ?? null,
    },
    { status: result.ok ? 200 : 502 },
  );
}
