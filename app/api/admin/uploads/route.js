import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { readImageUpload, saveImageUpload } from '@/lib/uploads';

/**
 * POST /api/admin/uploads — accept one product photo from Patricia.
 *
 * Expects multipart/form-data with a single `file` field.
 *
 * The session is checked before the body is touched. Everything about the file
 * itself — size, real format, the name it is stored under — is decided in
 * lib/uploads.js, which is also what the members' profile-picture route uses.
 *
 * Responses
 *   201 { ok: true, path: '/uploads/<name>' or an R2 URL }
 *   400 no file, unreadable form, or file type we will not accept
 *   401 no valid session
 *   413 file over the size cap
 *   500 could not write
 */

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — plenty for a product photo

export async function POST(request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, errors: ['Not signed in.'] }, { status: 401 });
  }

  const read = await readImageUpload(request, MAX_BYTES);
  if (!read.ok) {
    return NextResponse.json({ ok: false, errors: [read.error] }, { status: read.status });
  }

  const path = await saveImageUpload(read.buffer, 'p');
  if (!path) {
    return NextResponse.json(
      {
        ok: false,
        errors: [
          'Could not save the image. Configure CLOUDINARY_* on this host, or run locally where public/uploads is writable.',
        ],
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, path }, { status: 201 });
}
