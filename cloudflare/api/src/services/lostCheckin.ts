import type {Deps} from '../app';
import type {Row} from '../lib/db';
import {CHECKIN_RESPONSE_WINDOW_MS} from '../lib/serialize';
import {addMs, DAY_MS, now} from '../lib/time';
import {addNotification, notifyLostFollowers} from './notifications';

const CHECKIN_INTERVAL_MS = 7 * DAY_MS;
const CHECKIN_NOTIFICATION = 'lost_checkin';
const AUTO_CANCEL_NOTIFICATION = 'lost_auto_cancelled';

async function petOf(deps: Deps, post: Row): Promise<Row | null> {
  return deps.db.get('pets', String(post.pet_id));
}

export async function clearCheckinNotifications(deps: Deps, post: Row) {
  await deps.db.run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = ? AND reference_id = ?',
    String(post.owner_id),
    CHECKIN_NOTIFICATION,
    String(post.id),
  );
}

export async function closeLostPost(deps: Deps, post: Row, status: string, at = now()) {
  const pet = await petOf(deps, post);
  await deps.db.run(
    'UPDATE lost_posts SET status = ?, closed_at = ?, checkin_asked_at = NULL, updated_at = ? WHERE id = ?',
    status,
    at,
    at,
    String(post.id),
  );
  Object.assign(post, {status, closed_at: at, checkin_asked_at: null, updated_at: at});
  if (pet && pet.status === 'lost') {
    await deps.db.run("UPDATE pets SET status = 'normal', updated_at = ? WHERE id = ?", at, String(pet.id));
  }
  await clearCheckinNotifications(deps, post);
  if (status === 'resolved') {
    const name = pet ? String(pet.name) : 'น้อง';
    await notifyLostFollowers(deps, post, 'lost_resolved', `${name} เจอแล้ว 🎉`, `เจ้าของแจ้งว่าเจอ ${name} แล้ว ขอบคุณที่ช่วยกันตามหา`);
  }
}

export async function answerCheckin(deps: Deps, post: Row, found: boolean, at = now()) {
  if (found) {
    await closeLostPost(deps, post, 'resolved', at);
    return;
  }
  await deps.db.run(
    'UPDATE lost_posts SET checkin_base_at = ?, checkin_asked_at = NULL, updated_at = ? WHERE id = ?',
    at,
    at,
    String(post.id),
  );
  Object.assign(post, {checkin_base_at: at, checkin_asked_at: null, updated_at: at});
  await clearCheckinNotifications(deps, post);
}

export async function runLostCheckins(deps: Deps, at = now()) {
  let asked = 0;
  let cancelled = 0;

  const due = await deps.db.all<Row>(
    `SELECT l.*, p.name AS pet_name FROM lost_posts l LEFT JOIN pets p ON p.id = l.pet_id
     WHERE l.status = 'active' AND COALESCE(l.created_by_admin, 0) = 0
       AND l.checkin_asked_at IS NULL AND COALESCE(l.checkin_base_at, l.created_at) <= ?`,
    addMs(at, -CHECKIN_INTERVAL_MS),
  );
  for (const post of due) {
    // Claim the post so overlapping runs cannot ask twice.
    const claimed = await deps.db.run(
      "UPDATE lost_posts SET checkin_asked_at = ?, updated_at = ? WHERE id = ? AND status = 'active' AND checkin_asked_at IS NULL",
      at,
      at,
      String(post.id),
    );
    if (!claimed) continue;
    const name = post.pet_name ? String(post.pet_name) : 'น้อง';
    await addNotification(
      deps,
      String(post.owner_id),
      CHECKIN_NOTIFICATION,
      `เจอ ${name} แล้วหรือยัง?`,
      `ประกาศตามหา ${name} ครบ 1 สัปดาห์แล้ว กดตอบว่าเจอแล้วหรือยังตามหาอยู่ ` +
        'ถ้าไม่ตอบภายใน 7 วัน ระบบจะยกเลิกประกาศให้อัตโนมัติ',
      'lost_post',
      String(post.id),
    );
    asked++;
  }

  const expired = await deps.db.all<Row>(
    `SELECT l.*, p.name AS pet_name FROM lost_posts l LEFT JOIN pets p ON p.id = l.pet_id
     WHERE l.status = 'active' AND COALESCE(l.created_by_admin, 0) = 0
       AND l.checkin_asked_at IS NOT NULL AND l.checkin_asked_at <= ?`,
    addMs(at, -CHECKIN_RESPONSE_WINDOW_MS),
  );
  for (const post of expired) {
    const name = post.pet_name ? String(post.pet_name) : 'น้อง';
    await closeLostPost(deps, post, 'cancelled', at);
    await addNotification(
      deps,
      String(post.owner_id),
      AUTO_CANCEL_NOTIFICATION,
      `ยกเลิกประกาศตามหา ${name} อัตโนมัติ`,
      'ไม่มีการตอบกลับภายใน 7 วันหลังแจ้งเตือน ถ้ายังตามหาอยู่ สร้างประกาศใหม่ได้ทุกเมื่อ',
      'lost_post',
      String(post.id),
    );
    cancelled++;
  }
  if (asked || cancelled) console.log(JSON.stringify({msg: 'lost check-ins', asked, cancelled}));
  return {asked, cancelled};
}
