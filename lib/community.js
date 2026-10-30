import crypto from 'node:crypto';
import { pool } from '@/lib/db';

/**
 * COMMUNITY CHAT STORE  (server only — uses Postgres)
 * ===================================================
 * One room, one stream of messages, oldest at the top. Every member who is
 * signed in is in the same conversation.
 *
 * There is no websocket. The browser asks "anything after this message id?" on a
 * timer and gets back only what is new, which is a few hundred bytes. A socket
 * that has to stay open is the wrong trade-off on an island mobile connection
 * that drops constantly — a short poll simply picks up where it left off.
 *
 * The room lives in `community_messages` (db/schema.sql). There is no JSON file
 * and no in-memory cache: a message Patricia sends from /admin is visible to a
 * member's next poll, on any server process. The two opening messages are seeded
 * once by db/migrations/006_community_seed.sql — not here — so deleting one is
 * permanent rather than reappearing on the next restart.
 *
 * Every message keeps a COPY of the author's display name, so rendering the room
 * never touches the customer table and therefore never loads anyone's email or
 * phone number.
 */

/** Chat lines are short by nature; this is a ceiling, not a target. */
const MAX_BODY = 1000;
const MIN_BODY = 1;

/**
 * How much of the room's history the page renders on arrival. Enough to pick up
 * yesterday's thread, small enough that the first paint is cheap.
 */
export const ROOM_LIMIT = 60;

/** A catch-up poll is capped so a member who left a tab open all week cannot
 *  ask for ten thousand messages in one response. */
const CATCH_UP_LIMIT = 200;

/**
 * Patricia's identity in the room.
 *
 * She has no member record — she never signed up — so she cannot be looked up in
 * the customer table the way everyone else is. Her admin session cookie carries
 * no user id either (see lib/auth.js: the token is just an expiry and a
 * signature), so a route acting on her behalf has nothing to derive an author
 * from and must use this constant instead.
 *
 * `id: 'owner'` is the same sentinel the chat UI already keys on — it matches
 * OWNER_PROFILE in components/community/MemberCard.js, which is what makes her
 * name open the founder card rather than an empty member card.
 */
export const OWNER_AUTHOR = { id: 'owner', name: 'Patricia' };

/**
 * Postgres row -> the camelCase message object the UI expects.
 *
 * created_at comes back as a Date; the components compare and render it as an
 * ISO string, so normalise it here rather than in every caller.
 */
function mapRow(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    fromOwner: row.from_owner,
    pinned: row.pinned,
    body: row.body,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

/**
 * Reject anything that is not a real message before it is stored.
 * @returns {{ ok: true, body: string } | { ok: false, error: string }}
 */
function cleanBody(value) {
  // Collapse runs of blank lines so nobody can push the room apart with returns.
  const body = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (body.length < MIN_BODY) return { ok: false, error: 'Write something first.' };
  if (body.length > MAX_BODY) return { ok: false, error: `Keep it under ${MAX_BODY} characters.` };
  return { ok: true, body };
}

/** The tail of the conversation, oldest first — what the page renders. */
export async function readRoom(limit = ROOM_LIMIT) {
  // Select the newest N, then flip them back into send order. The id is only a
  // tie-breaker for the rare case of two messages sharing a timestamp.
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT * FROM community_messages
       ORDER BY created_at DESC, id DESC
       LIMIT $1
     ) recent
     ORDER BY created_at ASC, id ASC`,
    [limit],
  );
  return rows.map(mapRow);
}

/**
 * Everything sent after one message id — the polling endpoint.
 * An unknown id (its message was deleted, or the room was reset) returns the
 * usual tail rather than nothing, so a stale tab recovers instead of going blank.
 */
export async function readMessagesAfter(afterId) {
  const anchor = await pool.query(
    'SELECT created_at FROM community_messages WHERE id = $1',
    [afterId],
  );

  if (anchor.rows.length === 0) return readRoom();

  const { rows } = await pool.query(
    `SELECT * FROM community_messages
      WHERE (created_at, id) > ($1::timestamptz, $2::text)
      ORDER BY created_at ASC, id ASC
      LIMIT $3`,
    [anchor.rows[0].created_at, afterId, CATCH_UP_LIMIT],
  );
  return rows.map(mapRow);
}

/**
 * Send a message.
 *
 * @param {{ id: string, name: string }} author the signed-in member, or
 *   OWNER_AUTHOR when Patricia is posting from /admin/community
 * @param {string} rawBody what she typed
 * @param {{ fromOwner?: boolean, pinned?: boolean }} [options]
 *   fromOwner marks the message as the founder's, which is what earns the gold
 *   "Founder" badge in the room. pinned lets an announcement go up already pinned
 *   instead of needing a second click afterwards.
 *
 *   SECURITY: these options are NOT derived from anything the caller sent over
 *   the wire. Only an admin-authenticated route may pass them — the member route
 *   calls this with no options at all, so a member cannot post as the founder.
 */
export async function addMessage(author, rawBody, options = {}) {
  const cleaned = cleanBody(rawBody);
  if (!cleaned.ok) return cleaned;

  const { rows } = await pool.query(
    `INSERT INTO community_messages
       (id, author_id, author_name, from_owner, pinned, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      `msg_${crypto.randomUUID()}`,
      author.id,
      author.name, // snapshot, so the room needs no customer lookup
      Boolean(options.fromOwner),
      Boolean(options.pinned),
      cleaned.body,
    ],
  );

  return { ok: true, message: mapRow(rows[0]) };
}

/**
 * The messages Patricia has pinned, newest pin target first.
 *
 * These are shown in a strip above the conversation, so a woman arriving late
 * still sees the house rules, the meet-up date, or whatever answer keeps getting
 * asked for — without scrolling back through the room.
 */
export async function readPinned() {
  const { rows } = await pool.query(
    'SELECT * FROM community_messages WHERE pinned ORDER BY created_at DESC, id DESC',
  );
  return rows.map(mapRow);
}

/**
 * Pin or unpin one message. Patricia only — checked in the route, not here.
 * @returns {Promise<object|null>} the updated message, or null if it is gone
 */
export async function setMessagePinned(id, pinned) {
  const { rows } = await pool.query(
    'UPDATE community_messages SET pinned = $2 WHERE id = $1 RETURNING *',
    [id, Boolean(pinned)],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Delete one message. A real delete, not an archive: the point of removing abuse
 * is that it stops being readable.
 */
export async function deleteMessage(id) {
  const { rowCount } = await pool.query(
    'DELETE FROM community_messages WHERE id = $1',
    [id],
  );
  return rowCount > 0;
}

/** Counters for the admin header. */
export async function getCommunityStats() {
  const { rows } = await pool.query(`
    SELECT
      count(*)::int                                  AS messages,
      count(*) FILTER (WHERE pinned)::int            AS pinned,
      count(DISTINCT author_id)::int                 AS voices,
      max(created_at)                                AS latest
    FROM community_messages
  `);

  const stats = rows[0];
  return {
    messages: stats.messages,
    pinned: stats.pinned,
    voices: stats.voices,
    latest: stats.latest ? new Date(stats.latest).toISOString() : null,
  };
}
