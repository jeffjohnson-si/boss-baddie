'use client';

import { useState } from 'react';
import Avatar from '@/components/community/Avatar';
import MemberCard, { OWNER_PROFILE } from '@/components/community/MemberCard';

/**
 * MEMBER LIST — who else is in here.
 *
 * A client component because the rows open: tapping one expands her profile card
 * underneath it, and tapping it again closes it. An accordion rather than a modal
 * on purpose — on a phone a modal has to be dismissed before she can carry on
 * reading, and there is nothing here worth interrupting her for.
 *
 * Only one card is open at a time, so a long list never turns into a wall.
 *
 * PRIVACY: this only ever receives what readMembersForRoom() returns — a name, a
 * picture, a join month and the bio she wrote herself. Emails, phone numbers and
 * locations never reach this page; they exist on /admin/community and nowhere
 * else. Removed members are already filtered out on the server.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Month and year only — the exact day someone signed up is nobody's business. */
function joinedLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function MemberList({ members = [], currentId = null }) {
  // 'owner' is Patricia's row; a member id otherwise; null for nothing open.
  const [openId, setOpenId] = useState(null);

  // Patricia is listed but is not a member record, so she is counted separately.
  const total = members.length + 1;

  function toggle(id) {
    setOpenId((current) => (current === id ? null : id));
  }

  const rowClass =
    'flex w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-bbRose/[0.06]';

  return (
    <aside className="border border-bbLine bg-bbCoal/40">
      <header className="border-b border-bbLine px-4 py-3">
        <p className="bb-eyebrow !text-[10px]">In here</p>
        <p className="mt-1.5 font-display text-sm text-bbInk">
          {total} {total === 1 ? 'woman' : 'women'}
        </p>
        <p className="mt-1 text-[11px] text-bbInk/35">Tap a name to see her profile</p>
      </header>

      {/* Capped height with its own scroll so a long list never pushes the chat
          off the screen. */}
      <ul className="max-h-[40vh] overflow-y-auto p-3 lg:max-h-[52vh]">
        {/* Patricia is not a member record — she is the founder, and she is
            always here. Listed first so a new arrival knows who runs the place. */}
        <li>
          <button
            type="button"
            onClick={() => toggle('owner')}
            aria-expanded={openId === 'owner'}
            className={rowClass}
          >
            <Avatar name="Patricia" src={OWNER_PROFILE.avatar} size={32} tone="rose" fit="contain" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-bbInk">Patricia</span>
              <span className="block text-[11px] text-bbGold">Founder</span>
            </span>
          </button>

          {openId === 'owner' && (
            <div className="mb-2 mt-1 border border-bbGold/25 bg-bbGold/[0.06] p-3">
              <MemberCard member={OWNER_PROFILE} isFounder />
            </div>
          )}
        </li>

        {members.map((member) => {
          const isYou = member.id === currentId;
          const isOpen = openId === member.id;

          return (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => toggle(member.id)}
                aria-expanded={isOpen}
                className={rowClass}
              >
                <Avatar
                  name={member.name}
                  src={member.avatar}
                  size={32}
                  tone={isYou ? 'rose' : 'default'}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-bbInk/85">
                    {member.name}
                    {isYou && <span className="ml-1.5 text-[11px] text-bbInk/40">(you)</span>}
                  </span>
                  <span className="block text-[11px] text-bbInk/35">
                    Joined {joinedLabel(member.joinedAt)}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="mb-2 mt-1 border border-bbLine bg-black/40 p-3">
                  <MemberCard member={member} isYou={isYou} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
