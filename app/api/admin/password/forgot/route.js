import { NextResponse } from 'next/server';
import {
  createPasswordReset,
  findAdminForPasswordReset,
  hashToken,
  isValidEmail,
  normaliseEmail,
  readResetRecipients,
} from '@/lib/admin-store';
import { sendEmail } from '@/lib/email';
import { siteOrigin } from '@/lib/site-url';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/admin/password/forgot — email a one-time reset link.
 *
 * The response is ALWAYS the same whether the address exists or not. That is what
 * stops this endpoint being used to enumerate admin and recovery addresses.
 *
 * Rate limited twice: per caller address, and per submitted email. The second key
 * is the SHA-256 of the address, so the in-memory map never holds raw emails.
 */

const IP_LIMIT = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;

const generic = () => NextResponse.json({ ok: true });

export async function POST(request) {
  const ipGate = hit(`admin-forgot-ip:${clientKey(request)}`, {
    limit: IP_LIMIT,
    windowMs: IP_WINDOW_MS,
  });
  if (!ipGate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipGate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const email = normaliseEmail(body?.email);
  if (!isValidEmail(email)) return generic();

  const emailGate = hit(`admin-forgot-email:${hashToken(email)}`, {
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailGate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests for that address. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(emailGate.retryAfter) } },
    );
  }

  try {
    const admin = await findAdminForPasswordReset(email);

    if (admin) {
      const token = await createPasswordReset(admin.id);
      const recipients = await readResetRecipients(admin.id);
      const origin = siteOrigin(request);
      const link = `${origin}/admin/reset?token=${encodeURIComponent(token)}`;

      await sendEmail({
        to: recipients,
        subject: 'Reset your BOSS BADDIE owner password',
        text:
          `Someone asked to reset the owner password for BOSS BADDIE.\n\n` +
          `Open this link within 30 minutes:\n${link}\n\n` +
          `If this was not you, ignore this email. The password has not changed.`,
        html:
          `<p>Someone asked to reset the owner password for <strong>BOSS BADDIE</strong>.</p>` +
          `<p><a href="${link}">Choose a new password</a></p>` +
          `<p>This link expires in 30 minutes. If this was not you, ignore this email — the password has not changed.</p>`,
      });
    }
  } catch (err) {
    // Still answer generically. A reset request must not reveal a database error
    // or whether the address is known.
    console.error('[api/admin/password/forgot]', err.message);
  }

  return generic();
}
