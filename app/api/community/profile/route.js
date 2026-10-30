import { NextResponse } from 'next/server';
import { currentCustomer } from '@/lib/current-customer';
import { setCommunityProfile } from '@/lib/customers';
import { deleteUpload, saveImageUpload, sniffImageExtension } from '@/lib/uploads';

/**
 * POST /api/community/profile — the one-off community profile.
 *
 * Name plus an optional picture. The phone number is NOT part of this form: it was
 * set when the account was created, it is the login handle, and it is displayed
 * beside her name in the room rather than being chosen here.
 *
 * The upload is checked by magic bytes, not by filename or declared type (the same
 * rule as product photos, lib/uploads.js), capped at 2 MB, and written under a name
 * the server generates. The picture it replaces is deleted only after the new row
 * has been saved, so a failed save cannot leave her without a picture.
 */

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Could not read the form.'] }, { status: 400 });
  }

  const displayName = String(form.get('name') ?? '');
  const file = form.get('file');

  let avatarPath = null;

  if (file && typeof file.arrayBuffer === 'function' && (file.size ?? 0) > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, errors: ['That picture is larger than 2 MB. Please use a smaller one.'] },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ ok: false, errors: ['That file is empty.'] }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, errors: ['That picture is larger than 2 MB. Please use a smaller one.'] },
        { status: 413 },
      );
    }
    if (!sniffImageExtension(buffer)) {
      return NextResponse.json(
        { ok: false, errors: ['Only PNG, JPEG and WebP images can be uploaded.'] },
        { status: 400 },
      );
    }

    avatarPath = await saveImageUpload(buffer, 'a');
    if (!avatarPath) {
      return NextResponse.json(
        { ok: false, errors: ['Could not save that picture. Try again.'] },
        { status: 500 },
      );
    }
  }

  const result = await setCommunityProfile(customer.id, { displayName, avatar: avatarPath });

  if (!result.ok) {
    // Nothing should be left on disk for a save that did not happen.
    if (avatarPath) await deleteUpload(avatarPath);
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  // Only now is the old picture surplus.
  if (avatarPath && customer.avatar) await deleteUpload(customer.avatar);

  return NextResponse.json({ ok: true, customer: result.customer });
}
