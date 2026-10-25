ALTER TABLE found_posts ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE found_posts ADD COLUMN reporter_ip_hash TEXT;
CREATE INDEX ix_found_posts_guest ON found_posts(reporter_ip_hash, created_at);

CREATE TABLE image_moderation (
  id TEXT PRIMARY KEY,
  filename TEXT,
  uploader_id TEXT,
  ip_hash TEXT,
  is_guest INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL,
  reason TEXT,
  model_output TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_image_moderation_filename ON image_moderation(filename);
CREATE INDEX ix_image_moderation_verdict ON image_moderation(verdict, created_at);
CREATE INDEX ix_image_moderation_guest ON image_moderation(ip_hash, created_at);

CREATE TABLE guest_blocks (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  blocked_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
