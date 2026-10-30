-- ===========================================================================
-- 004 — COMMUNITY PROFILE
-- ===========================================================================
-- The account already has a name and a phone number, so registering is what opens
-- the community. But the room wants two things the account does not carry:
--
--   community_name  the name she wants the sisterhood to see (she may prefer a
--                   business name or a nickname to the one on her order)
--   avatar          a picture, shown beside everything she says
--
-- `community_profile_set_at` is the flag the room gates on: until it is set, she is
-- sent to /community/setup once. The phone number is deliberately NOT duplicated
-- here — it stays `customers.phone`, the login handle, and is displayed beside her
-- name in the chat.
-- ===========================================================================

BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS community_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS community_profile_set_at TIMESTAMPTZ;

COMMIT;
