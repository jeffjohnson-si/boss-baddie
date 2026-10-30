import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { displayNameProblems, updateAdminDisplayName } from '@/lib/admin-store';

/**
 * PATCH /api/admin/account — the owner's display name.
 *
 * The primary email is intentionally not editable here. Changing it safely needs a
 * confirmation sent to the new address, and a half-built version of that is worse
 * than asking a developer to do it once.
 */
export async function PATCH(request) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }
  if (admin.id === 'env') {
    return NextResponse.json(
      { ok: false, errors: ['Create the owner account before editing it.'] },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const displayName = String(body?.displayName ?? '').trim();
  const errors = displayNameProblems(displayName);
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const updated = await updateAdminDisplayName(admin.id, displayName);
  if (!updated) {
    return NextResponse.json({ ok: false, errors: ['Account not found.'] }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    admin: { id: updated.id, email: updated.email, displayName: updated.displayName },
  });
}
