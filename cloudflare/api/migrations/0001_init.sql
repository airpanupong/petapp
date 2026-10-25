-- Mirrors the PostgreSQL schema at Alembic head 0012.
-- Timestamps are ISO-8601 UTC text with millisecond precision ("2026-10-01T12:00:00.000Z"),
-- dates are "YYYY-MM-DD", booleans are 0/1 and JSON columns hold JSON text.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT,
  privacy_accepted_at TEXT,
  data_access_accepted_at TEXT,
  consent_version TEXT
);

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE password_reset_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_password_reset_codes_user_id ON password_reset_codes(user_id);

CREATE TABLE pets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_code TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  animal_type TEXT NOT NULL,
  breed TEXT,
  gender TEXT,
  color TEXT,
  birth_date TEXT,
  weight REAL,
  description TEXT,
  distinctive_marks TEXT,
  microchip_id TEXT,
  profile_image_url TEXT,
  emergency_note TEXT,
  status TEXT NOT NULL DEFAULT 'normal',
  is_public INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_pets_owner_id ON pets(owner_id);
CREATE INDEX ix_pets_animal_type ON pets(animal_type);
CREATE INDEX ix_pets_status ON pets(status);

CREATE TABLE pet_images (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_pet_images_pet_id ON pet_images(pet_id);

CREATE TABLE pet_guardians (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'guardian',
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_mark_lost INTEGER NOT NULL DEFAULT 1,
  can_view_private_info INTEGER NOT NULL DEFAULT 0,
  can_receive_notifications INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_pet_guardian_user UNIQUE (pet_id, user_id)
);
CREATE INDEX ix_pet_guardians_pet_id ON pet_guardians(pet_id);
CREATE INDEX ix_pet_guardians_user_id ON pet_guardians(user_id);

CREATE TABLE lost_posts (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  description TEXT,
  lost_at TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_text TEXT,
  search_radius_km REAL NOT NULL DEFAULT 5.0,
  reward_enabled INTEGER NOT NULL DEFAULT 0,
  reward_text TEXT,
  image_url TEXT,
  image_urls TEXT,
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  closed_at TEXT,
  checkin_base_at TEXT,
  checkin_asked_at TEXT
);
CREATE INDEX ix_lost_posts_pet_id ON lost_posts(pet_id);
CREATE INDEX ix_lost_posts_owner_id ON lost_posts(owner_id);
CREATE INDEX ix_lost_posts_status ON lost_posts(status);
CREATE INDEX ix_lost_posts_checkin_asked_at ON lost_posts(checkin_asked_at);

CREATE TABLE found_posts (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  animal_type TEXT NOT NULL,
  breed_guess TEXT,
  color TEXT,
  description TEXT,
  image_url TEXT,
  image_urls TEXT,
  found_at TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_found_posts_reporter_id ON found_posts(reporter_id);
CREATE INDEX ix_found_posts_animal_type ON found_posts(animal_type);
CREATE INDEX ix_found_posts_status ON found_posts(status);

CREATE TABLE sightings (
  id TEXT PRIMARY KEY,
  lost_post_id TEXT NOT NULL REFERENCES lost_posts(id) ON DELETE CASCADE,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  seen_at TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_text TEXT,
  direction TEXT,
  description TEXT,
  image_url TEXT,
  image_urls TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_sightings_lost_post_id ON sightings(lost_post_id);

CREATE TABLE ads (
  id TEXT PRIMARY KEY,
  advertiser_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  target_url TEXT,
  ad_type TEXT NOT NULL DEFAULT 'native',
  status TEXT NOT NULL DEFAULT 'active',
  start_at TEXT,
  end_at TEXT,
  target_latitude REAL,
  target_longitude REAL,
  target_radius_km REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_ads_status ON ads(status);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'lost_found',
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_conversation_member UNIQUE (conversation_id, user_id)
);
CREATE INDEX ix_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX ix_conversation_members_user_id ON conversation_members(user_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  read_at TEXT
);
CREATE INDEX ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX ix_messages_sender_id ON messages(sender_id);
CREATE INDEX ix_messages_created_at ON messages(created_at);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolver_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT
);
CREATE INDEX ix_reports_reporter_id ON reports(reporter_id);
CREATE INDEX ix_reports_status ON reports(status);

CREATE TABLE user_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_user_block UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX ix_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX ix_user_blocks_blocked_id ON user_blocks(blocked_id);

CREATE TABLE pet_health_profiles (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL UNIQUE REFERENCES pets(id) ON DELETE CASCADE,
  allergies TEXT,
  medications TEXT,
  conditions TEXT,
  vet_name TEXT,
  vet_phone TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE vaccinations (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  given_at TEXT NOT NULL,
  next_due_at TEXT,
  clinic_name TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_vaccinations_pet_id ON vaccinations(pet_id);

CREATE TABLE pet_emergency_infos (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL UNIQUE REFERENCES pets(id) ON DELETE CASCADE,
  public_allergies TEXT,
  public_medications TEXT,
  public_conditions TEXT,
  emergency_note TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  show_contact_phone INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE ownership_verifications (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  evidence_note TEXT,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT
);
CREATE INDEX ix_ownership_verifications_pet_id ON ownership_verifications(pet_id);
CREATE INDEX ix_ownership_verifications_owner_id ON ownership_verifications(owner_id);
CREATE INDEX ix_ownership_verifications_status ON ownership_verifications(status);

CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  lost_alerts INTEGER NOT NULL DEFAULT 1,
  radius_km REAL NOT NULL DEFAULT 5.0,
  animal_type TEXT NOT NULL DEFAULT 'all',
  chat_notifications INTEGER NOT NULL DEFAULT 1,
  marketing_notifications INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE user_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_notifications_user_id ON notifications(user_id);
CREATE INDEX ix_notifications_type ON notifications(type);
CREATE INDEX ix_notifications_is_read ON notifications(is_read);
CREATE INDEX ix_notifications_created_at ON notifications(created_at);

CREATE TABLE lost_case_followers (
  id TEXT PRIMARY KEY,
  lost_post_id TEXT NOT NULL REFERENCES lost_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_lost_case_follower UNIQUE (lost_post_id, user_id)
);
CREATE INDEX ix_lost_case_followers_lost_post_id ON lost_case_followers(lost_post_id);
CREATE INDEX ix_lost_case_followers_user_id ON lost_case_followers(user_id);

CREATE TABLE device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  token TEXT NOT NULL,
  device_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_device_platform_token UNIQUE (platform, token)
);
CREATE INDEX ix_device_tokens_user_id ON device_tokens(user_id);

CREATE TABLE web_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_web_push_subscriptions_user_id ON web_push_subscriptions(user_id);

CREATE TABLE ad_events (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_ad_events_ad_id ON ad_events(ad_id);
CREATE INDEX ix_ad_events_user_id ON ad_events(user_id);
