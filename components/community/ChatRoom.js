'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/community/Avatar';
import MemberCard, { OWNER_PROFILE } from '@/components/community/MemberCard';

/**
 * CHAT ROOM — one stream of messages, newest at the bottom.
 *
 * The first screenful arrives as server-rendered HTML in `initialMessages`, so the
 * conversation is readable before this component hydrates. After that:
 *
 *   - Sending POSTs the message and appends the row the server hands back, so
 *     what you see is what was actually stored.
 *   - New messages from other women arrive by asking
 *     GET /api/community/messages?after=<last id> on a timer. Only what is new
 *     comes down the wire — a quiet day costs a few hundred bytes a poll.
 *   - Polling stops while the tab is hidden and catches up in one request when she
 *     comes back. On a metered island connection that matters more than instant.
 *
 * There is no websocket on purpose: a socket that has to stay open is the wrong
 * shape for a mobile connection that drops every few minutes.
 *
 * PICTURES AND PROFILES: a message stores its author's name at the time it was
 * sent, and nothing else about her. The picture and bio are looked up by
 * `authorId` in `profiles` (what readMembersForRoom() returned), so changing your
 * picture changes it on everything you have ever said rather than only on what
 * you say next. A member who joined after this page was rendered is not in that
 * list yet, and falls back to her initials until the next reload.
 *
 * Tapping a name opens her card; tapping her picture opens the picture itself,
 * full size. Two separate things because they answer two different questions —
 * "who is she?" and "let me see that".
 *
 * MODERATING: when `isOwner` is set, every row grows a Pin and a Delete button.
 * They are here rather than on an admin page so Patricia judges a message with the
 * conversation around it in view.
 */

/** Slow enough to be kind to a metered connection, quick enough to feel live. */
const POLL_MS = 10000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Times are formatted from UTC parts. `toLocaleTimeString` would use the server's
 * timezone during render and the visitor's in the browser, and React would flag a
 * hydration mismatch on every message.
 */
function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function formatDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Small gold pin. Inline SVG rather than an icon font — nothing extra to load. */
function PinIcon({ size = 10 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 1.5h4M6 1.5v4M6 5.5 3 8.5h6L6 5.5M6 8.5v2" />
    </svg>
  );
}

export default function ChatRoom({
  initialMessages = [],
  initialPinned = [],
  profiles = [],
  member,
  isOwner = false,
}) {

  const [messages, setMessages] = useState(initialMessages);
  const [pinned, setPinned] = useState(initialPinned);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  // The profile card that is open over the conversation, or null.
  const [openProfile, setOpenProfile] = useState(null);
  // The picture being looked at full size, or null. `{ src, name, fit }`.
  const [openPicture, setOpenPicture] = useState(null);
  // Which message Patricia is currently pinning or deleting, so its buttons can
  // disable themselves without freezing the rest of the room.
  const [moderatingId, setModeratingId] = useState(null);


  const scroller = useRef(null);
  // Kept in a ref as well as state so the polling loop always reads the current
  // value without having to be torn down and rebuilt on every new message.
  const lastId = useRef(initialMessages[initialMessages.length - 1]?.id ?? null);

  /** Author id -> her profile, so a message row is one lookup rather than a scan. */
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  /** Tapping a name opens her card; tapping the same name again closes it. */
  function toggleProfile(message) {
    const profile = message.fromOwner
      ? OWNER_PROFILE
      : profileById.get(message.authorId) ?? { id: message.authorId, name: message.authorName };

    setOpenProfile((current) => (current?.id === profile.id ? null : profile));
  }

  /* ---- Escape closes whatever is open ----
      The picture sits over the profile card, so Escape dismisses that first and
      leaves the card she opened it from still up. */
  useEffect(() => {
    if (!openProfile && !openPicture) return undefined;
    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      if (openPicture) setOpenPicture(null);
      else setOpenProfile(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openProfile, openPicture]);


  /** Append only what we do not already have — a retried poll must not duplicate. */
  const merge = useCallback((incoming) => {
    if (!incoming || incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh];
      lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  /* ---- Poll for what other members have said ---- */
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      // Nothing to fetch for a tab nobody is looking at.
      if (document.hidden) return;
      try {
        const url = lastId.current
          ? `/api/community/messages?after=${encodeURIComponent(lastId.current)}`
          : '/api/community/messages';
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return; // a dropped connection is normal here; try again next tick
        const data = await response.json();
        if (cancelled || !data.ok) return;
        merge(data.messages);
        // Replaced wholesale rather than merged: a message Patricia unpinned has
        // to disappear from the strip, not linger.
        setPinned(data.pinned ?? []);
      } catch {
        // Offline. Say nothing and try again on the next tick.
      }
    }

    const timer = setInterval(poll, POLL_MS);
    // Coming back to the tab should feel instant, not up-to-ten-seconds late.
    document.addEventListener('visibilitychange', poll);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [merge]);

  /* ---- Keep the newest message in view ---- */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    if (!body.trim() || sending) return;

    setError('');
    setSending(true);

    try {
      // Patricia and the members write through different endpoints. Hers is the
      // admin-gated one, which is the only place `fromOwner: true` is applied —
      // that separation is what stops a member posting as the founder.
      const endpoint = isOwner ? '/api/admin/community/messages' : '/api/community/messages';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'That did not send. Try again.');
        return;
      }

      setBody('');
      merge([data.message]);
    } catch {
      setError('Could not reach the server. Your message was not sent.');
    } finally {
      setSending(false);
    }
  }


  /* ---- Moderating, Patricia only ----
      These live in the room rather than on a separate admin page so she decides
      with the conversation in front of her. Both call the admin-gated endpoint;
      the buttons below only render when `isOwner`, and the endpoint checks the
      admin cookie again — the hidden button is not the security. */

  /**
   * Pin or unpin. No confirmation: the same button undoes it.
   *
   * The pinned strip is refetched rather than patched locally, because the server
   * decides the order pins appear in and there is no reason to duplicate that
   * rule here. Passing `after=<last id>` keeps the reply small — we only want the
   * `pinned` array out of it.
   */
  async function togglePin(message) {
    if (moderatingId) return;
    setModeratingId(message.id);
    setError('');

    try {
      const response = await fetch(`/api/admin/community/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !message.pinned }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'That did not work. Try again.');
        return;
      }

      // The row's own pin marker, from what the server actually stored.
      setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));

      const refreshed = await fetch(
        lastId.current
          ? `/api/community/messages?after=${encodeURIComponent(lastId.current)}`
          : '/api/community/messages',
        { cache: 'no-store' },
      );
      if (refreshed.ok) {
        const fresh = await refreshed.json().catch(() => ({}));
        if (fresh.ok) setPinned(fresh.pinned ?? []);
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setModeratingId(null);
    }
  }

  /** Deleting is permanent, so it asks first. */
  async function removeMessage(message) {
    if (moderatingId) return;
    if (!window.confirm('Delete this message for everyone? This cannot be undone.')) return;

    setModeratingId(message.id);
    setError('');

    try {
      const response = await fetch(`/api/admin/community/messages/${message.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'That did not work. Try again.');
        return;
      }

      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== message.id);
        // The poll asks for everything after `lastId`. If that id was the message
        // just deleted the server would have nothing to anchor on, so point it at
        // whatever is now last — or back to null for an emptied room.
        if (lastId.current === message.id) {
          lastId.current = next[next.length - 1]?.id ?? null;
        }
        return next;
      });

      // A deleted message that was pinned has to leave the strip too.
      setPinned((prev) => prev.filter((m) => m.id !== message.id));
    } catch {
      setError('Could not reach the server.');
    } finally {
      setModeratingId(null);
    }
  }

  /** Enter sends; Shift+Enter starts a new line. */
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(event);
    }
  }

  return (
    // `relative` so the profile card can float over the conversation.
    <div className="relative flex flex-col border border-bbLine bg-bbCoal/40">
      {/* ---- Pinned by Patricia ----
          Above the conversation and OUTSIDE the scroller, so it never moves as the
          room scrolls, and `sticky` as well, so it does not leave with the page
          either — on a phone the chat is taller than the screen, and without this
          the strip scrolls off the top the moment she starts reading.

          It parks under the site header (72px, 92px from lg) rather than at the very
          top, because that header is itself sticky at z-50 and would cover it.

          The background is the solid equivalent of the gold tint instead of a
          translucent one: messages now pass BEHIND this strip, and 6% gold over
          nothing would let them show through.

          Any number of messages can be pinned, newest pin first, so the strip has
          its own scroll and a count — several pins must not be able to push the
          conversation off the screen. */}
      {pinned.length > 0 && (
        <section
          aria-label="Pinned by Patricia"
          className="sticky top-[72px] z-20 max-h-44 overflow-y-auto border-b border-bbGold/25 bg-[#18120f] px-4 py-3 lg:top-[92px]"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-editorial text-bbGold">
            <PinIcon />
            Pinned
            {pinned.length > 1 && <span className="text-bbGold/60">· {pinned.length}</span>}
          </p>

          {/* Divided rather than merely spaced: with three or four pins, unrelated
              messages otherwise read as one paragraph. */}
          <ul className="mt-2 divide-y divide-bbGold/15">
            {pinned.map((message) => (
              <li key={message.id} className="py-2 first:pt-0 last:pb-0">
                <p className="whitespace-pre-line text-sm leading-relaxed text-bbInk/85">
                  {message.body}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <p className="text-[11px] text-bbInk/35">
                    {message.authorName} · {formatDay(message.createdAt)}
                  </p>

                  {/* Unpinning from here as well as from the message itself: with
                      several pins, hunting back through the conversation for the
                      one she wants gone is the whole problem the strip solves.
                      Same call either way — the endpoint checks her admin cookie. */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => togglePin(message)}
                      disabled={moderatingId === message.id}
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-bbGold disabled:opacity-40"
                    >
                      {moderatingId === message.id ? 'Unpinning…' : 'Unpin'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- The conversation ---- */}
      <div
        ref={scroller}
        // aria-live so a screen reader announces messages that arrive by polling.
        aria-live="polite"
        aria-label="Community chat"
        className="flex h-[60vh] flex-col gap-1 overflow-y-auto p-4 sm:h-[64vh] sm:p-5"
      >
        {messages.length === 0 && (
          <p className="m-auto max-w-xs text-center text-sm text-bbInk/40">
            Nobody has said anything yet. Say the first thing.
          </p>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const mine = message.authorId === member.id;
          // Consecutive messages from the same woman lose the repeated name.
          const grouped = previous && previous.authorId === message.authorId;
          const newDay = !previous || formatDay(previous.createdAt) !== formatDay(message.createdAt);
          // Her picture, or null when she has not uploaded one and the row shows
          // initials instead. Only a real picture is worth opening full size.
          const avatarSrc =
            grouped && !newDay
              ? null
              : message.fromOwner
                ? OWNER_PROFILE.avatar
                : profileById.get(message.authorId)?.avatar ?? null;

          return (
            <div key={message.id}>
              {newDay && (
                <p className="my-4 text-center text-[10px] font-semibold uppercase tracking-editorial text-bbInk/30">
                  {formatDay(message.createdAt)}
                </p>
              )}

              <div className={`flex gap-3 ${grouped && !newDay ? 'mt-0.5' : 'mt-4'} ${mine ? 'flex-row-reverse' : ''}`}>
                {/* The picture only appears on the first message of a run, and it
                    comes from her profile rather than from the message, so a new
                    picture applies to everything she has ever said.

                    Patricia is looked up separately: she has no member record, so
                    she is not in `profiles`, and her picture is the brand mark.

                    Tapping it opens her card: who she is, when she joined and the
                    picture itself, at whatever size she uploaded. The card opens
                    the picture full size on a second tap. */}
                {avatarSrc ? (
                  <button
                    type="button"
                    onClick={() => toggleProfile(message)}
                    title={`Open ${mine ? 'your' : `${message.authorName}'s`} profile`}
                    className="shrink-0 self-start transition-opacity hover:opacity-80"
                  >
                    <span className="sr-only">
                      Open {mine ? 'your' : `${message.authorName}'s`} profile
                    </span>
                    <Avatar
                      name={message.authorName}
                      src={avatarSrc}
                      size={32}
                      fit={message.fromOwner ? 'contain' : 'cover'}
                      tone={message.fromOwner || mine ? 'rose' : 'default'}
                    />
                  </button>
                ) : (
                  <Avatar
                    name={message.authorName}
                    src={null}
                    size={32}
                    tone={grouped && !newDay ? 'hidden' : message.fromOwner || mine ? 'rose' : 'default'}
                  />
                )}

                <div className={`max-w-[78%] ${mine ? 'text-right' : ''}`}>
                  {(!grouped || newDay) && (
                    <p className={`flex items-center gap-2 text-xs ${mine ? 'justify-end' : ''}`}>
                      {/* A button, not just text: tapping a name opens her profile. */}
                      <button
                        type="button"
                        onClick={() => toggleProfile(message)}
                        className="font-display text-bbInk underline decoration-bbLine decoration-dotted underline-offset-4 transition-colors hover:text-bbBlush"
                      >
                        {mine ? 'You' : message.authorName}
                      </button>
                      {message.fromOwner && (
                        <span className="border border-bbGold/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-bbGold">
                          Founder
                        </span>
                      )}
                      <span className="text-bbInk/35">{formatTime(message.createdAt)}</span>
                      {message.pinned && (
                        <span className="text-bbGold" title="Pinned by Patricia">
                          <PinIcon size={9} />
                        </span>
                      )}
                    </p>
                  )}

                  <p
                    className={`mt-1 inline-block whitespace-pre-line border px-3.5 py-2.5 text-left text-sm leading-relaxed ${
                      mine
                        ? 'border-bbRose/30 bg-bbRose/[0.12] text-bbInk'
                        : 'border-bbLine bg-black/40 text-bbInk/85'
                    }`}
                  >
                    {message.body}
                  </p>

                  {/* Patricia's controls, on every message including her own.
                      Always visible rather than hidden behind a long-press: a
                      long-press has no discoverable equivalent on a desktop and
                      no affordance on a phone. */}
                  {isOwner && (
                    <p className={`mt-1 flex items-center gap-3 ${mine ? 'justify-end' : ''}`}>
                      <button
                        type="button"
                        onClick={() => togglePin(message)}
                        disabled={moderatingId === message.id}
                        className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bbGold disabled:opacity-40"
                      >
                        {message.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMessage(message)}
                        disabled={moderatingId === message.id}
                        className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Whose message you tapped ----
          Floats over the bottom of the conversation rather than opening a modal:
          the chat stays visible behind it, and it is dismissed with the X, with
          Escape, or by tapping the same name again. */}
      {openProfile && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[76px] z-10 px-4 sm:bottom-[86px] sm:px-5">
          <div className="pointer-events-auto relative border border-bbRose/30 bg-bbCoal p-4 shadow-xl shadow-black/60">
            <button
              type="button"
              onClick={() => setOpenProfile(null)}
              aria-label="Close profile"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center text-lg leading-none text-bbInk/40 transition-colors hover:text-bbInk"
            >
              ×
            </button>

            <MemberCard
              member={openProfile}
              isYou={openProfile.id === member.id}
              isFounder={openProfile.id === 'owner'}
              onOpenPicture={
                openProfile.avatar
                  ? () =>
                      setOpenPicture({
                        src: openProfile.avatar,
                        name: openProfile.name,
                        fit: openProfile.id === 'owner' ? 'contain' : 'cover',
                      })
                  : null
              }
            />
          </div>
        </div>
      )}

      {/* ---- One picture, full size ----
          A real modal this time, not a floating card: the point is to look at the
          picture, so it covers the room and dims what is behind it. Tapping the
          backdrop closes it, which is what a thumb reaches for first; the × and
          Escape do the same for everyone else.

          The image is capped at the size it was uploaded at rather than stretched
          to the viewport — avatars are shrunk in the browser before upload, so
          blowing one up past its own pixels only makes it blurry. */}
      {openPicture && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${openPicture.name} · picture`}
          onClick={() => setOpenPicture(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div
            // Stops a tap on the picture itself counting as a tap on the backdrop.
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-full w-full max-w-sm border border-bbRose/30 bg-bbCoal p-3"
          >
            <img
              src={openPicture.src}
              alt={`${openPicture.name}'s profile picture`}
              className={`mx-auto max-h-[70vh] w-auto ${
                openPicture.fit === 'contain' ? 'object-contain p-4' : 'object-contain'
              }`}
            />

            <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-editorial text-bbInk/45">
              {openPicture.name} · tap anywhere to close
            </p>

            <button
              type="button"
              onClick={() => setOpenPicture(null)}
              aria-label="Close picture"
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-xl leading-none text-bbInk/50 transition-colors hover:text-bbInk"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ---- Say something ---- */}
      <form onSubmit={send} className="border-t border-bbLine p-3 sm:p-4">
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              placeholder="Say something…"
              className="bb-input max-h-32 resize-y"
            />
          </label>

          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="bb-btn-solid !px-6 disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>

        <p className="mt-2 text-xs text-bbInk/30">
          Enter sends · Shift + Enter for a new line · every baddie in here sees this
        </p>
      </form>
    </div>
  );
}
