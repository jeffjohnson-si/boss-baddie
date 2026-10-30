import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { deleteMessage, setMessagePinned } from '@/lib/community';

/**
 * Moderating one message. Patricia only.
 *
 *   PATCH  /api/admin/community/messages/<id>   body { pinned: boolean }
 *   DELETE /api/admin/community/messages/<id>
 *
 * Pinning is reversible and DELETE is not, which is why they are separate verbs:
 * pinning is an editorial choice, deleting is removing something from the room for
 * good.
 */
export async function PATCH(request, { params }) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  // Next.js 15 hands route params over as a Promise.
  const { id } = await params;


  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body?.pinned !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Send { pinned: true | false }.' }, { status: 422 });
  }

  const message = await setMessagePinned(id, body.pinned);
  if (!message) {
    return NextResponse.json({ ok: false, error: 'That message is gone.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message });
}

export async function DELETE(request, { params }) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await params;


  const removed = await deleteMessage(id);
  if (!removed) {
    return NextResponse.json({ ok: false, error: 'It is already gone.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
