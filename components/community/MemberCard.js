'use client';

import Link from 'next/link';
import Avatar from '@/components/community/Avatar';

/**
 * MEMBER CARD — the small profile that opens when you tap a name.
 *
 * Shown in two places: under a row in the member list, and floating over the chat
 * when you tap an author's name. Both use this one component so a woman's profile
 * looks the same wherever it is opened from.
 *
 * PRIVACY: everything here comes from readMembersForRoom() — a name, a picture,
 * a join month and the bio she wrote herself. There is no email, phone or
 * location to leak, because they were never sent to the browser.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Patricia has no member record — she is the founder, not a signup — so her card
 * is written here. Exported so the member list and the chat show the same thing.
 *
 * Her picture is the brand mark rather than a photograph: in the room she is
 * speaking as BOSS BADDIE, and the logo is the one image that is unmistakably
 * hers and already on the server. The transparent version is used because
 * /logo.png has no alpha and would paint a black rectangle. It is drawn with
 * `fit="contain"`, since the mark is landscape and cropping it to a square would
 * cut a third of it away.
 */
export const OWNER_PROFILE = {
  id: 'owner',
  name: 'Patricia',
  avatar: '/logo-mark.png',
  bio: 'Founder of BOSS BADDIE. Ask me anything in here — pricing, suppliers, or getting paid on time.',
};

/** Month and year only — the exact day someone signed up is nobody's business. */
function joinedLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function MemberCard({ member, isYou = false, isFounder = false, onOpenPicture = null }) {
  if (!member) return null;

  return (
    <div className="flex gap-3">
      {onOpenPicture ? (
        <button
          type="button"
          onClick={onOpenPicture}
          title={`See ${member.name}'s picture full size`}
          className="shrink-0 self-start transition-opacity hover:opacity-80"
        >
          <span className="sr-only">See {member.name}&apos;s picture full size</span>
          <Avatar
            name={member.name}
            src={member.avatar}
            size={64}
            tone={isFounder || isYou ? 'rose' : 'default'}
            fit={isFounder ? 'contain' : 'cover'}
          />
        </button>
      ) : (
        <Avatar
          name={member.name}
          src={member.avatar}
          size={64}
          tone={isFounder || isYou ? 'rose' : 'default'}
          fit={isFounder ? 'contain' : 'cover'}
        />
      )}

      <div className="min-w-0">
        <p className="font-display text-sm text-bbInk">
          {member.name}
          {isYou && <span className="ml-1.5 text-[11px] font-normal text-bbInk/40">(you)</span>}
        </p>

        <p className="mt-0.5 text-[11px] text-bbGold">
          {isFounder ? 'Founder' : member.joinedAt ? `Joined ${joinedLabel(member.joinedAt)}` : ''}
        </p>

        {member.bio ? (
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-bbInk/70">{member.bio}</p>
        ) : (
          <p className="mt-2 text-xs italic text-bbInk/30">
            {isYou ? 'You have not written a description yet.' : 'Nothing written here yet.'}
          </p>
        )}

        {isYou && (
          <Link href="/account/profile" className="bb-link mt-2 inline-block text-xs">
            Edit your profile
          </Link>
        )}
      </div>
    </div>
  );
}
