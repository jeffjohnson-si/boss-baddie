import { NextResponse } from 'next/server';
import { addMessage, readMessagesAfter, readPinned, readRoom } from '@/lib/community';
import { currentRoomViewer } from '@/lib/current-member';

/**
 * The chat room.
 *
 *   GET  /api/community/messages?after=<id>   what is new since that message
 *   POST /api/community/messages              send a message
 *
 * GET is the polling endpoint the room calls on a timer: with `after` it returns
 * only newer messages, so a quiet room costs a few hundred bytes a poll. It is open
 * to any signed-in member AND to Patricia, so her tab keeps up with the
 * conversation the same way theirs does.
 *
 * POST is members only. Patricia sends through /api/admin/community/messages
 * instead, because that is where `fromOwner: true` is applied — keeping the two
 * write paths apart is what makes it impossible for a member to post wearing the
 * founder's badge.
 *
 * Every GET also returns the current pinned list. It is short, and sending it
 * every time is what makes Patricia pinning something show up in a tab that is
 * already open — the alternative is a second endpoint nobody would call.
 *
 * The author is taken from the session cookie and never from the request body, so
 * nobody can send a message under someone else's name.
 */
export async function GET(request) {
  const viewer = await currentRoomViewer();
  if (!viewer) {
    return NextResponse.json(
      { ok: false, error: 'Sign in to read The Baddies Corner.' },
      { status: 401 },
    );
  }


  const after = new URL(request.url).searchParams.get('after');
  const [messages, pinned] = await Promise.all([
    after ? readMessagesAfter(after) : readRoom(),
    readPinned(),
  ]);

  // The room is live: a cached response would show a stale conversation.
  return NextResponse.json(
    { ok: true, messages, pinned },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request) {
  // The author comes from the session cookie — a customer, or Patricia on her
  // admin session. It is never read from the request body.
  const viewer = await currentRoomViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: 'Sign in to send a message.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const result = await addMessage(viewer, body?.body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, message: result.message }, { status: 201 });
}
