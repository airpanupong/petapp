import type {Deps} from '../app';
import {uuid, type Row} from '../lib/db';
import {haversineKm} from '../lib/geo';
import {bool} from '../lib/serialize';
import {now} from '../lib/time';
import {sendPushToUser} from './push';
import {notificationPing} from './realtime';

export async function addNotification(
  deps: Deps,
  userId: string,
  type: string,
  title: string,
  body: string,
  referenceType: string | null = null,
  referenceId: string | null = null,
): Promise<string> {
  const id = uuid();
  await deps.db.insert('notifications', {
    id,
    user_id: userId,
    type,
    title,
    body,
    reference_type: referenceType,
    reference_id: referenceId,
    is_read: false,
    created_at: now(),
  });
  if (type !== 'chat_message') notificationPing(deps, userId);
  await sendPushToUser(deps, userId, title, body, {
    type,
    reference_type: referenceType ?? '',
    reference_id: referenceId ?? '',
  });
  return id;
}

export async function notifyPetGuardians(
  deps: Deps,
  petId: string,
  type: string,
  title: string,
  body: string,
  referenceType: string | null = null,
  referenceId: string | null = null,
  excludeUserId: string | null = null,
): Promise<number> {
  const guardians = await deps.db.all<{user_id: string}>(
    'SELECT user_id FROM pet_guardians WHERE pet_id = ? AND can_receive_notifications = 1',
    petId,
  );
  let count = 0;
  for (const g of guardians) {
    if (g.user_id === excludeUserId) continue;
    await addNotification(deps, g.user_id, type, title, body, referenceType, referenceId);
    count++;
  }
  return count;
}

export const DEFAULT_ALERT_RADIUS_KM = 5.0;
export const FOUND_MATCH_MIN_RADIUS_KM = 5.0;

export function animalWord(animalType: string | null | undefined): string {
  return animalType === 'cat' ? 'แมว' : animalType === 'dog' ? 'สุนัข' : 'สัตว์';
}

/** Python's f"{x:.1f}" */
const km1 = (x: number) => x.toFixed(1);

/** Users whose last known location is within their alert radius; users without preferences get the defaults. */
export async function nearbyAlertRecipients(
  deps: Deps,
  latitude: number,
  longitude: number,
  animalType: string,
  maxRadiusKm: number | null = null,
  exclude: Set<string> = new Set(),
): Promise<[string, number][]> {
  const rows = await deps.db.all<Row>(
    `SELECT l.user_id, l.latitude, l.longitude, p.id AS pref_id, p.lost_alerts, p.animal_type, p.radius_km
     FROM user_locations l LEFT JOIN notification_preferences p ON p.user_id = l.user_id`,
  );
  const matches: [string, number][] = [];
  for (const r of rows) {
    const userId = String(r.user_id);
    if (exclude.has(userId)) continue;
    const hasPrefs = r.pref_id != null;
    if (hasPrefs && !bool(r.lost_alerts)) continue;
    const wanted = hasPrefs ? String(r.animal_type) : 'all';
    if (wanted !== 'all' && wanted !== animalType) continue;
    let radius = hasPrefs ? Number(r.radius_km) : DEFAULT_ALERT_RADIUS_KM;
    if (maxRadiusKm != null) radius = Math.min(radius, Number(maxRadiusKm));
    const distance = haversineKm(Number(r.latitude), Number(r.longitude), latitude, longitude);
    if (distance <= radius) matches.push([userId, distance]);
  }
  return matches;
}

export async function dispatchLostAlerts(deps: Deps, post: Row, pet: Row): Promise<number> {
  const recipients = await nearbyAlertRecipients(
    deps,
    Number(post.latitude),
    Number(post.longitude),
    String(pet.animal_type),
    Number(post.search_radius_km),
    new Set([String(post.owner_id)]),
  );
  for (const [userId, distance] of recipients) {
    await addNotification(
      deps,
      userId,
      'lost_pet_alert',
      `มี${animalWord(String(pet.animal_type))}หายใกล้คุณ`,
      `${pet.name} หายห่างจากตำแหน่งล่าสุดของคุณประมาณ ${km1(distance)} กม.`,
      'lost_post',
      String(post.id),
    );
  }
  return recipients.length;
}

/** Tell owners of matching lost pets nearby first, then everyone else nearby. */
export async function dispatchFoundAlerts(deps: Deps, post: Row): Promise<number> {
  const notified = new Set<string>();
  if (post.reporter_id) notified.add(String(post.reporter_id));
  const animal = animalWord(String(post.animal_type));
  const lat = Number(post.latitude);
  const lng = Number(post.longitude);

  const lostRows = await deps.db.all<Row>(
    `SELECT l.id, l.owner_id, l.latitude, l.longitude, l.search_radius_km, p.name AS pet_name, p.animal_type AS pet_animal
     FROM lost_posts l JOIN pets p ON p.id = l.pet_id WHERE l.status = 'active'`,
  );
  for (const lost of lostRows) {
    const ownerId = String(lost.owner_id);
    if (notified.has(ownerId)) continue;
    if (post.animal_type !== 'other' && lost.pet_animal !== post.animal_type) continue;
    const distance = haversineKm(Number(lost.latitude), Number(lost.longitude), lat, lng);
    if (distance > Math.max(Number(lost.search_radius_km), FOUND_MATCH_MIN_RADIUS_KM)) continue;
    await addNotification(
      deps,
      ownerId,
      'found_match_alert',
      `มีคนพบ${animal}ใกล้จุดที่ ${lost.pet_name} หาย`,
      `ห่างจากจุดที่ ${lost.pet_name} หายประมาณ ${km1(distance)} กม. กดดูว่าใช่น้องหรือเปล่า`,
      'found_post',
      String(post.id),
    );
    notified.add(ownerId);
  }

  for (const [userId, distance] of await nearbyAlertRecipients(deps, lat, lng, String(post.animal_type), null, notified)) {
    await addNotification(
      deps,
      userId,
      'found_pet_alert',
      `มีคนพบ${animal}ใกล้คุณ`,
      `ห่างจากคุณประมาณ ${km1(distance)} กม. ช่วยดูหน่อยว่าเป็นน้องของใครแถวบ้านหรือเปล่า`,
      'found_post',
      String(post.id),
    );
    notified.add(userId);
  }
  return notified.size - (post.reporter_id ? 1 : 0);
}

export async function notifyLostFollowers(deps: Deps, post: Row, type: string, title: string, body: string) {
  const followers = await deps.db.all<{user_id: string}>(
    'SELECT user_id FROM lost_case_followers WHERE lost_post_id = ?',
    String(post.id),
  );
  let count = 0;
  for (const f of followers) {
    if (f.user_id === post.owner_id) continue;
    await addNotification(deps, f.user_id, type, title, body, 'lost_post', String(post.id));
    count++;
  }
  return count;
}

export async function notifySighting(deps: Deps, post: Row, reporterId: string | null): Promise<number> {
  const recipients = new Set<string>([String(post.owner_id)]);
  for (const f of await deps.db.all<{user_id: string}>(
    'SELECT user_id FROM lost_case_followers WHERE lost_post_id = ?',
    String(post.id),
  )) {
    recipients.add(f.user_id);
  }
  for (const g of await deps.db.all<{user_id: string}>(
    'SELECT user_id FROM pet_guardians WHERE pet_id = ? AND can_receive_notifications = 1',
    String(post.pet_id),
  )) {
    recipients.add(g.user_id);
  }
  if (reporterId) recipients.delete(reporterId);
  for (const userId of recipients) {
    await addNotification(
      deps,
      userId,
      'new_sighting',
      'มีเบาะแสใหม่ 👀',
      'มีผู้ใช้แจ้งจุดที่พบเห็นในเคสสัตว์หายที่คุณติดตาม',
      'lost_post',
      String(post.id),
    );
  }
  return recipients.size;
}
