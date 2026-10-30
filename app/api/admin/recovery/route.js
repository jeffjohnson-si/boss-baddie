import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import {
  addRecoveryEmail,
  deleteRecoveryEmail,
  isValidEmail,
  normaliseEmail,
} from '@/lib/admin-store';
import { sendEmail } from '@/lib/email';
import { siteOrigin } from '@/lib/site-url';
import { hit } from '@/lib/rate-limit';

/**
 * POST /api/admin/recovery — add a pending recovery address.
 *
 * The address only starts receiving reset links after the confirmation email is
 * opened. If the email cannot be sent, the pending row is deleted so the address
 * can be tried again rather than being stuck unverified.
 */

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }
  if (admin.id === 'env') {
    return NextResponse.json(
      { ok: false, errors: ['Create the owner account before adding recovery emails.'] },
      { status: 403 },
    );
  }

  const gate = hit(`admin-recovery:${admin.id}`, { limit: LIMIT, windowMs: WINDOW_MS });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many attempts. Try again later.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const email = normaliseEmail(body?.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, errors: ['Enter a valid email address.'] }, { status: 422 });
  }

  let added;
  try {
    added = await addRecoveryEmail(admin.id, email);
  } catch (err) {
    console.error('[api/admin/recovery] could not add address:', err.message);
    return NextResponse.json(
      { ok: false, errors: ['Could not add that address. Try again.'] },
      { status: 500 },
    );
  }

  if (!added.ok) {
    return NextResponse.json({ ok: false, errors: [added.error] }, { status: 422 });
  }

  const origin = siteOrigin(request);
  const link = `${origin}/admin/recovery/verify?token=${encodeURIComponent(added.token)}`;

  const sent = await sendEmail({
    to: added.email,
    subject: 'Confirm a recovery email for BOSS BADDIE',
    text:
      `Confirm this address so it can receive password-reset links for the BOSS BADDIE owner account.\n\n` +
      `${link}\n\n` +
      `This link expires in 24 hours. If you did not add it, ignore this email.`,
    html:
      `<p>Confirm this address so it can receive password-reset links for the <strong>BOSS BADDIE</strong> owner account.</p>` +
      `<p><a href="${link}">Confirm this recovery email</a></p>` +
      `<p>This link expires in 24 hours. If you did not add it, ignore this email.</p>`,
  });

  if (!sent.ok) {
    await deleteRecoveryEmail(admin.id, added.id);
    return NextResponse.json(
      { ok: false, errors: ['The verification email could not be sent. Check the email settings and try again.'] },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, email: added.email });
}
