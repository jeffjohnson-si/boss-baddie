import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { deleteRecoveryEmail } from '@/lib/admin-store';

/** DELETE /api/admin/recovery/:id — remove a recovery address. */
export async function DELETE(request, { params }) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }
  if (admin.id === 'env') {
    return NextResponse.json(
      { ok: false, errors: ['Create the owner account first.'] },
      { status: 403 },
    );
  }

  const { id } = await params;
  const removed = await deleteRecoveryEmail(admin.id, id);
  if (!removed) {
    return NextResponse.json({ ok: false, errors: ['That address is already gone.'] }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
