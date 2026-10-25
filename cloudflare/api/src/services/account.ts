import type {Deps, User} from '../app';
import {jsonList} from '../lib/serialize';
import {deleteUrl} from './storage';

const PETS = 'SELECT id FROM pets WHERE owner_id = ?1';
const LOST = `SELECT id FROM lost_posts WHERE owner_id = ?1 OR pet_id IN (${PETS})`;
const FOUND = 'SELECT id FROM found_posts WHERE reporter_id = ?1';
const SIGHTINGS = `SELECT id FROM sightings WHERE reporter_id = ?1 OR lost_post_id IN (${LOST})`;
const CONVERSATIONS = 'SELECT conversation_id FROM conversation_members WHERE user_id = ?1';

/**
 * Permanently removes the user with their pets, posts, chats and uploaded photos.
 *
 * Conversations are removed for both members: a chat with one side erased is meaningless and still exposes
 * the deleted user's messages.
 */
export async function deleteAccount(deps: Deps, user: User): Promise<void> {
  const {db} = deps;
  const uid = user.id;

  const photoRows = await db.batch([
    db.stmt(`SELECT profile_image_url AS url FROM pets WHERE owner_id = ?1`, uid),
    db.stmt(`SELECT image_url AS url FROM pet_images WHERE pet_id IN (${PETS})`, uid),
    db.stmt(`SELECT evidence_url AS url FROM ownership_verifications WHERE owner_id = ?1 OR pet_id IN (${PETS})`, uid),
    db.stmt(`SELECT image_url AS url FROM messages WHERE conversation_id IN (${CONVERSATIONS})`, uid),
    db.stmt(`SELECT image_url AS url, image_urls AS urls FROM lost_posts WHERE id IN (${LOST})`, uid),
    db.stmt(`SELECT image_url AS url, image_urls AS urls FROM found_posts WHERE id IN (${FOUND})`, uid),
    db.stmt(`SELECT image_url AS url, image_urls AS urls FROM sightings WHERE id IN (${SIGHTINGS})`, uid),
  ]);
  const files: (string | null)[] = [user.avatar_url as string | null];
  for (const result of photoRows) {
    for (const row of result.results as {url?: string | null; urls?: string | null}[]) {
      files.push(row.url ?? null, ...(jsonList(row.urls) ?? []));
    }
  }

  // One batch is one transaction in D1, so the account disappears atomically.
  await db.batch([
    db.stmt(
      `DELETE FROM notifications WHERE user_id = ?1 OR reference_id IN (${PETS}) OR reference_id IN (${LOST})
         OR reference_id IN (${FOUND}) OR reference_id IN (${CONVERSATIONS})`,
      uid,
    ),
    db.stmt(`DELETE FROM messages WHERE conversation_id IN (${CONVERSATIONS})`, uid),
    db.stmt(`DELETE FROM conversations WHERE id IN (${CONVERSATIONS})`, uid),
    db.stmt(`DELETE FROM sightings WHERE id IN (${SIGHTINGS})`, uid),
    db.stmt(`DELETE FROM lost_case_followers WHERE user_id = ?1 OR lost_post_id IN (${LOST})`, uid),
    db.stmt(`DELETE FROM lost_posts WHERE id IN (${LOST})`, uid),
    db.stmt(`DELETE FROM found_posts WHERE id IN (${FOUND})`, uid),
    db.stmt('DELETE FROM ownership_verifications WHERE owner_id = ?1', uid),
    db.stmt('DELETE FROM pet_guardians WHERE user_id = ?1', uid),
    ...['pet_health_profiles', 'vaccinations', 'pet_emergency_infos', 'ownership_verifications', 'pet_images', 'pet_guardians'].map(
      table => db.stmt(`DELETE FROM ${table} WHERE pet_id IN (${PETS})`, uid),
    ),
    db.stmt('DELETE FROM pets WHERE owner_id = ?1', uid),
    ...['refresh_tokens', 'password_reset_codes', 'notification_preferences', 'user_locations', 'device_tokens', 'web_push_subscriptions'].map(
      table => db.stmt(`DELETE FROM ${table} WHERE user_id = ?1`, uid),
    ),
    db.stmt('DELETE FROM reports WHERE reporter_id = ?1', uid),
    db.stmt('UPDATE reports SET resolver_id = NULL WHERE resolver_id = ?1', uid),
    db.stmt('DELETE FROM user_blocks WHERE blocker_id = ?1 OR blocked_id = ?1', uid),
    db.stmt('UPDATE ad_events SET user_id = NULL WHERE user_id = ?1', uid),
    db.stmt('DELETE FROM users WHERE id = ?1', uid),
  ]);

  const unique = [...new Set(files.filter((u): u is string => !!u))];
  deps.waitUntil(Promise.all(unique.map(url => deleteUrl(deps.env, url))));
}
