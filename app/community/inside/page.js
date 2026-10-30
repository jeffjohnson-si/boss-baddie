import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChatRoom from '@/components/community/ChatRoom';
import MemberList from '@/components/community/MemberList';
import SignOutButton from '@/components/community/SignOutButton';
import { readPinned, readRoom } from '@/lib/community';
import { currentRoomViewer } from '@/lib/current-member';
import { readCustomersForRoom } from '@/lib/customers';

export const metadata = {
  title: 'The Baddies Corner',
  // Members-only conversation: keep it out of search results.
  robots: { index: false, follow: false },
};

// A live room: the first paint must never come from a cache.
export const dynamic = 'force-dynamic';

/**
 * THE ROOM — the chat, open to anyone with an account.
 *
 * ONE ACCOUNT. Members are `customers` rows now, so a woman who registered in the
 * shop — and confirmed the code texted to her — lands here with the same sign-in.
 * There is no separate community registration and no approval step.
 *
 * The authorisation check happens HERE, in a server component, before a single
 * message is read. Someone signed out is sent to sign in and brought straight back
 * (`?next=/community/inside`). The same check runs again in the messages endpoint,
 * so hiding this page is not the only thing between a stranger and the conversation.
 *
 * PATRICIA IS IN THE ROOM TOO, on her admin session (currentRoomViewer handles both
 * identities). She reads the same conversation everyone else does.
 *
 * The opening screenful is rendered on the server and handed to ChatRoom, which
 * then keeps itself current by polling.
 */
export default async function CommunityRoomPage() {
  const viewer = await currentRoomViewer();
  if (!viewer) {
    redirect('/account/login?next=/community/inside');
  }

  // One step before the room: her community name and picture. Patricia is
  // exempt — she is the founder, not a member.
  if (!viewer.isOwner && !viewer.profileComplete) {
    redirect('/community/setup');
  }

  const [messages, pinned, members] = await Promise.all([
    readRoom(),
    readPinned(),
    readCustomersForRoom(),
  ]);

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        {/* ---- Header ---- */}
        <header className="flex flex-col gap-4 border-b border-bbLine pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="bb-eyebrow">The Sisterhood</p>
            <h1 className="bb-h2 mt-3">The Baddies Corner</h1>
            <p className="mt-2 text-sm text-bbInk/50">
              Signed in as {viewer.name} · {viewer.isOwner ? 'founder' : 'members only'}
            </p>
          </div>

          <nav className="flex items-center gap-4">
            {viewer.isOwner ? (
              <>
                <Link href="/admin/community" className="bb-link">
                  Moderate
                </Link>
                <Link href="/admin" className="bb-link">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/account/profile" className="bb-link">
                  Your account
                </Link>
                <Link href="/community" className="bb-link">
                  About the community
                </Link>
                <SignOutButton />
              </>
            )}
          </nav>
        </header>

        {/* Chat first in the markup, so on a phone she lands in the conversation
            and the member list sits underneath it. On desktop the list moves to a
            column beside the room. */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div>
            <ChatRoom
              initialMessages={messages}
              initialPinned={pinned}
              profiles={members}
              member={viewer}
              isOwner={viewer.isOwner}
            />

            {viewer.isOwner ? (
              <p className="mt-4 text-xs leading-relaxed text-bbInk/40">
                You are posting as the founder — everything you send here carries your Founder badge.
                Pin and Delete sit under each message, and a pinned message stays at the top of the
                room for everyone.
              </p>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-bbInk/40">
                Everything you send here is visible to every member, under your name. Patricia can
                delete anything that does not belong.
              </p>
            )}
          </div>

          <MemberList members={members} currentId={viewer.id} />
        </div>
      </div>
    </section>
  );
}
