-- Admin-created lost/found posts. Private columns are staff-only and must not be returned publicly.
ALTER TABLE lost_posts ADD COLUMN created_by_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lost_posts ADD COLUMN private_owner_name TEXT;
ALTER TABLE lost_posts ADD COLUMN private_phone TEXT;
ALTER TABLE lost_posts ADD COLUMN private_link TEXT;
ALTER TABLE lost_posts ADD COLUMN private_note TEXT;

ALTER TABLE found_posts ADD COLUMN created_by_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE found_posts ADD COLUMN private_owner_name TEXT;
ALTER TABLE found_posts ADD COLUMN private_phone TEXT;
ALTER TABLE found_posts ADD COLUMN private_link TEXT;
ALTER TABLE found_posts ADD COLUMN private_note TEXT;
