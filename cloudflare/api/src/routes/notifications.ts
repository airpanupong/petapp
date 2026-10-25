import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, type AppEnv, type Ctx} from '../app';
import {uuid, type Row} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {makeCursor, olderThan} from '../lib/pagination';
import {PRIVATE_POST_STATUSES} from '../lib/roles';
import {deviceTokenRead, notificationRead, preferencesRead} from '../lib/serialize';
import {now} from '../lib/time';
import {bool as boolField, int, num, parseBody, parseQuery, str} from '../lib/validate';
import {sendWebPushToUser, webPushEnabled} from '../services/push';
import {lostPostListItem} from './posts';

const PreferencesUpdate = z.object({
  lost_alerts: boolField().default(true),
  radius_km: num().pipe(z.number().min(1).max(50)).default(5),
  animal_type: z.enum(['all', 'dog', 'cat', 'other']).default('all'),
  chat_notifications: boolField().default(true),
  marketing_notifications: boolField().default(false),
});
const LocationUpdate = z.object({
  latitude: num().pipe(z.number().min(-90).max(90)),
  longitude: num().pipe(z.number().min(-180).max(180)),
});
const DeviceTokenCreate = z.object({
  platform: z.enum(['ios', 'android']),
  token: str(1000, 1),
  device_id: str(200).nullish(),
});
const WebPushSubscribe = z.object({
  endpoint: str(1000, 12).regex(/^https:\/\//),
  keys: z.object({p256dh: str(200, 1), auth: str(100, 1)}),
});
const WebPushUnsubscribe = z.object({endpoint: str(1000, 1)});

const PageQuery = (max: number, fallback: number) =>
  z.object({before: z.string().optional(), limit: int().pipe(z.number().min(1).max(max)).default(fallback)});

export const notifications = new Hono<AppEnv>();

async function preferencesFor(c: Ctx, userId: string): Promise<Row> {
  const {db} = deps(c);
  const existing = await db.one<Row>('SELECT * FROM notification_preferences WHERE user_id = ?', userId);
  if (existing) return existing;
  await db.run(
    'INSERT INTO notification_preferences (id, user_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING',
    uuid(),
    userId,
    now(),
  );
  return (await db.one<Row>('SELECT * FROM notification_preferences WHERE user_id = ?', userId))!;
}

notifications.get('/notifications', async c => {
  const user = await currentUser(c);
  const q = parseQuery(c, PageQuery(100, 100));
  const {db} = deps(c);
  const cursor = await olderThan(db, 'notifications', 'created_at', q.before);
  const rows = await db.all<Row>(
    `SELECT * FROM notifications WHERE user_id = ? ${cursor ? `AND ${cursor.sql}` : ''}
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    user.id,
    ...(cursor?.params ?? []),
    q.limit,
  );
  return c.json(success(rows.map(notificationRead)));
});

notifications.get('/notifications/unread-count', async c => {
  const user = await currentUser(c);
  // Chat messages have their own badge on the chat icon.
  const count = await deps(c).db.count(
    "SELECT COUNT(id) FROM notifications WHERE user_id = ? AND is_read = 0 AND type != 'chat_message'",
    user.id,
  );
  return c.json(success({count}));
});

notifications.post('/notifications/read-all', async c => {
  const user = await currentUser(c);
  const updated = await deps(c).db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', user.id);
  return c.json(success({updated}));
});

notifications.post('/notifications/:notificationId/read', async c => {
  const user = await currentUser(c);
  const {db} = deps(c);
  const row = await db.one<Row>(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
    c.req.param('notificationId'),
    user.id,
  );
  if (!row) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', String(row.id));
  return c.json(success(notificationRead({...row, is_read: 1})));
});

notifications.delete('/notifications/:notificationId', async c => {
  const user = await currentUser(c);
  await deps(c).db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', c.req.param('notificationId'), user.id);
  return c.body(null, 204);
});

notifications.delete('/notifications', async c => {
  const user = await currentUser(c);
  const deleted = await deps(c).db.run('DELETE FROM notifications WHERE user_id = ?', user.id);
  return c.json(success({deleted}));
});

notifications.get('/notification-preferences', async c => {
  const user = await currentUser(c);
  return c.json(success(preferencesRead(await preferencesFor(c, user.id))));
});

notifications.put('/notification-preferences', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, PreferencesUpdate);
  const row = await preferencesFor(c, user.id);
  const fields = {...body, updated_at: now()};
  await deps(c).db.update('notification_preferences', String(row.id), fields);
  return c.json(success(preferencesRead({...row, ...fields})));
});

notifications.put('/me/location', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, LocationUpdate);
  const ts = now();
  await deps(c).db.run(
    `INSERT INTO user_locations (id, user_id, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, updated_at = excluded.updated_at`,
    uuid(),
    user.id,
    body.latitude,
    body.longitude,
    ts,
  );
  return c.json(success({latitude: body.latitude, longitude: body.longitude, updated_at: ts}));
});

notifications.post('/lost-posts/:postId/follow', async c => {
  const user = await currentUser(c);
  const {db} = deps(c);
  const postId = c.req.param('postId');
  if (!(await db.get('lost_posts', postId))) throw new AppError(404, 'LOST_POST_NOT_FOUND', 'Lost post not found');
  await db.run(
    'INSERT INTO lost_case_followers (id, lost_post_id, user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
    uuid(),
    postId,
    user.id,
    now(),
  );
  return c.json(success({following: true}), 201);
});

notifications.delete('/lost-posts/:postId/follow', async c => {
  const user = await currentUser(c);
  await deps(c).db.run('DELETE FROM lost_case_followers WHERE lost_post_id = ? AND user_id = ?', c.req.param('postId'), user.id);
  return c.body(null, 204);
});

notifications.get('/lost-posts/:postId/follow', async c => {
  const user = await currentUser(c);
  const row = await deps(c).db.one(
    'SELECT id FROM lost_case_followers WHERE lost_post_id = ? AND user_id = ?',
    c.req.param('postId'),
    user.id,
  );
  return c.json(success({following: row !== null}));
});

notifications.get('/me/following-cases', async c => {
  const user = await currentUser(c);
  const q = parseQuery(c, PageQuery(100, 30));
  const {db} = deps(c);
  // Lost cases the user follows (not their own posts), most recently followed first.
  const cursor = await olderThan(db, 'lost_case_followers', 'created_at', q.before);
  const rows = await db.all<Row>(
    `SELECT l.*, lost_case_followers.id AS f_id, lost_case_followers.created_at AS f_created_at,
            p.id AS p_id, p.name AS p_name, p.animal_type AS p_animal_type, p.breed AS p_breed,
            p.color AS p_color, p.profile_image_url AS p_profile_image_url
     FROM lost_case_followers
     JOIN lost_posts l ON l.id = lost_case_followers.lost_post_id
     JOIN pets p ON p.id = l.pet_id
     WHERE lost_case_followers.user_id = ? AND l.owner_id != ?
       AND l.status NOT IN (${PRIVATE_POST_STATUSES.map(() => '?').join(', ')})
       ${cursor ? `AND ${cursor.sql}` : ''}
     ORDER BY lost_case_followers.created_at DESC, lost_case_followers.id DESC LIMIT ?`,
    user.id,
    user.id,
    ...PRIVATE_POST_STATUSES,
    ...(cursor?.params ?? []),
    q.limit,
  );
  return c.json(
    success(
      rows.map(row => ({
        ...lostPostListItem(row),
        followed_at: row.f_created_at,
        cursor: makeCursor(String(row.f_created_at), String(row.f_id)),
      })),
    ),
  );
});

notifications.post('/devices', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, DeviceTokenCreate);
  const {db} = deps(c);
  const ts = now();
  await db.run(
    `INSERT INTO device_tokens (id, user_id, platform, token, device_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(platform, token) DO UPDATE SET user_id = excluded.user_id, device_id = excluded.device_id,
       is_active = 1, updated_at = excluded.updated_at`,
    uuid(),
    user.id,
    body.platform,
    body.token,
    body.device_id ?? null,
    ts,
    ts,
  );
  const row = await db.one<Row>('SELECT * FROM device_tokens WHERE platform = ? AND token = ?', body.platform, body.token);
  return c.json(success(deviceTokenRead(row!)), 201);
});

notifications.get('/push/web/config', c => {
  const enabled = webPushEnabled(c.env);
  return c.json(success({enabled, public_key: enabled ? c.env.VAPID_PUBLIC_KEY : null}));
});

notifications.post('/push/web/subscriptions', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, WebPushSubscribe);
  const userAgent = (c.req.header('user-agent') ?? '').slice(0, 300) || null;
  const ts = now();
  await deps(c).db.run(
    `INSERT INTO web_push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
       user_agent = excluded.user_agent, updated_at = excluded.updated_at`,
    uuid(),
    user.id,
    body.endpoint,
    body.keys.p256dh,
    body.keys.auth,
    userAgent,
    ts,
    ts,
  );
  return c.json(success({subscribed: true}), 201);
});

notifications.post('/push/web/unsubscribe', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, WebPushUnsubscribe);
  await deps(c).db.run('DELETE FROM web_push_subscriptions WHERE endpoint = ? AND user_id = ?', body.endpoint, user.id);
  return c.json(success({subscribed: false}));
});

notifications.post('/push/web/test', async c => {
  const user = await currentUser(c);
  if (!webPushEnabled(c.env)) throw new AppError(503, 'WEB_PUSH_DISABLED', 'Web push is not configured');
  // The user asked for a push to their own browsers, so this one is sent even while external effects are off.
  const sent = await sendWebPushToUser(
    deps(c),
    user.id,
    'Pet haii',
    'เปิดการแจ้งเตือนเรียบร้อยแล้ว เราจะบอกทันทีเมื่อมีน้องหายใกล้คุณ',
    undefined,
    true,
  );
  return c.json(success({sent}));
});
