-- ===========================================================================
-- 006 — COMMUNITY SEED MESSAGES
-- ===========================================================================
-- Two opening messages from Patricia so the first woman in does not arrive to
-- silence. This is a one-time seed, applied with the schema rather than inserted
-- by the application: deleting a message in /admin is permanent, and a restart
-- must not bring it back.
--
-- ON CONFLICT means re-running this file is safe.
-- ===========================================================================

BEGIN;

INSERT INTO community_messages
  (id, author_id, author_name, from_owner, pinned, body, created_at)
VALUES
  (
    'msg_seed_welcome',
    'owner',
    'Patricia',
    TRUE,
    TRUE, -- pinned: the house rules should be the first thing she reads
    'Welcome in. This is The Baddies Corner — ask the question you think is too small to ask. Pricing, suppliers, customers who do not pay, how to photograph a case on a phone. Nobody here started out knowing any of it.',
    '2026-08-10T08:00:00.000Z'
  ),
  (
    'msg_seed_intro',
    'owner',
    'Patricia',
    TRUE,
    FALSE,
    'Say hello when you come in: your name, where you are, and the one thing you are trying to get moving this month.',
    '2026-08-12T21:30:00.000Z'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
