import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { addMessage, OWNER_AUTHOR } from '@/lib/community';

/**
 * Patricia posting into The Baddies Corner.
 *
 *   POST /api/admin/community/messages   body { body: string, pinned?: boolean }
 *
 * WHY THIS IS A SEPARATE ROUTE from /api/community/messages:
 * that one resolves its author from the MEMBER session cookie, and Patricia has no
 * member record — she never signed up. Her admin cookie is a different cookie
 * entirely and carries no user id, so there is nothing in it to look up. This route
 * therefore checks the admin session and then posts as OWNER_AUTHOR.
 *
 * SECURITY: `fromOwner: true` is set HERE and nowhere a member can reach. The
 * member route calls addMessage() with no options, so it is not possible for
 * somebody to post a message wearing the founder's badge by sending a crafted body.
 */
export async function POST(request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // Length and emptiness are validated inside addMessage, so there is one set of
  // rules for the room rather than two that can drift apart.
  const result = await addMessage(OWNER_AUTHOR, payload?.body, {
    fromOwner: true,
    // Optional: post an announcement already pinned instead of pinning it after.
    pinned: payload?.pinned === true,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, message: result.message }, { status: 201 });
}
