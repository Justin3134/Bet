-- Replace clerk_id with insforge_user_id
ALTER TABLE users DROP CONSTRAINT users_clerk_id_key;
DROP INDEX IF EXISTS idx_users_clerk_id;
ALTER TABLE users DROP COLUMN clerk_id;
ALTER TABLE users ADD COLUMN insforge_user_id TEXT UNIQUE;
