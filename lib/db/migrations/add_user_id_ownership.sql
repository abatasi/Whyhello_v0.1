-- Migration: Add user_id ownership columns for multi-user Clerk authentication
-- Applied as part of Replit Auth → Clerk migration.
--
-- Strategy: nullable columns so existing rows are preserved with NULL user_id.
-- NULL user_id = "legacy shared" row, readable by any authenticated user.
--
-- Backfill (optional, run after migration to assign legacy data to an owner):
--   UPDATE lists SET user_id = '<clerk-user-id>' WHERE user_id IS NULL;
--   UPDATE saved_searches SET user_id = '<clerk-user-id>' WHERE user_id IS NULL;
--   UPDATE contact_chat_messages SET user_id = '<clerk-user-id>' WHERE user_id IS NULL;
-- Replace '<clerk-user-id>' with the Clerk user ID of the primary/existing user.

-- lists: scope each list to its owning user
ALTER TABLE lists ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- saved_searches: scope each saved search to its owning user
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
-- Drop global unique name constraint and replace with per-user unique name
-- (NULL values are excluded from unique checks in PG, so legacy rows with NULL are unaffected)
ALTER TABLE saved_searches DROP CONSTRAINT IF EXISTS saved_searches_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_id_name_key ON saved_searches (user_id, name);

-- contact_chat_messages: scope each chat thread to its owning user
ALTER TABLE contact_chat_messages ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
