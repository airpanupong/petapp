import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, optionalUser, type AppEnv} from '../app';
import {uuid, type Db, type Row} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {haversineKm} from '../lib/geo';
import {adRead, reportRead} from '../lib/serialize';
import {now} from '../lib/time';
import {num, optStr, parseBody, parseQuery} from '../lib/validate';

const AdsQuery = z.object({
  latitude: num().pipe(z.number().min(-90).max(90)).optional(),
  longitude: num().pipe(z.number().min(-180).max(180)).optional(),
});
const AdEventCreate = z.object({event_type: z.enum(['impression', 'click'])});
const ReportCreate = z.object({
  target_type: z.enum(['post', 'user', 'message', 'ad', 'lost_post', 'found_post']),
  target_id: z.string(),
  reason: z.enum(['spam', 'fake_post', 'fraud', 'inappropriate', 'animal_abuse', 'harassment', 'other']),
  details: optStr(2000),
});

export const misc = new Hono<AppEnv>();

// ---------- Ads ----------

misc.get('/ads', async c => {
  const q = parseQuery(c, AdsQuery);
  const ts = now();
  const rows = await deps(c).db.all<Row>(
    `SELECT * FROM ads WHERE status = 'active' AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)
     ORDER BY created_at DESC LIMIT 20`,
    ts,
    ts,
  );
  const result = rows.filter(ad => {
    if (
      q.latitude != null &&
      q.longitude != null &&
      ad.target_latitude != null &&
      ad.target_longitude != null &&
      ad.target_radius_km != null
    ) {
      return haversineKm(q.latitude, q.longitude, Number(ad.target_latitude), Number(ad.target_longitude)) <= Number(ad.target_radius_km);
    }
    return true;
  });
  return c.json(success(result.map(adRead)));
});

misc.post('/ads/:adId/events', async c => {
  const user = await optionalUser(c);
  const body = await parseBody(c, AdEventCreate);
  const {db} = deps(c);
  const adId = c.req.param('adId');
  if (!(await db.get('ads', adId))) throw new AppError(404, 'AD_NOT_FOUND', 'Ad not found');
  await db.insert('ad_events', {id: uuid(), ad_id: adId, user_id: user?.id ?? null, event_type: body.event_type, created_at: now()});
  return c.json(success({tracked: true, event_type: body.event_type}), 201);
});

// ---------- Moderation ----------

misc.post('/reports', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, ReportCreate);
  const targetType = ['lost_post', 'found_post', 'post'].includes(body.target_type) ? 'post' : body.target_type;
  const row = {
    id: uuid(),
    reporter_id: user.id,
    target_type: targetType,
    target_id: body.target_id,
    reason: body.reason,
    details: body.details ?? null,
    status: 'open',
    resolver_id: null,
    resolver_note: null,
    created_at: now(),
    resolved_at: null,
  };
  const {db} = deps(c);
  await db.insert('reports', row);
  if (targetType === 'post') await hideWhenReportedEnough(db, body.target_id, row.created_at);
  return c.json(success(reportRead(row)), 201);
});

const AUTO_HIDE_REPORTERS = 3;

/** Several different people reporting the same post hides it until an admin looks (the admin page can unhide). */
async function hideWhenReportedEnough(db: Db, postId: string, ts: string) {
  const reporters = await db.count(
    "SELECT COUNT(DISTINCT reporter_id) FROM reports WHERE target_type = 'post' AND target_id = ? AND status = 'open'",
    postId,
  );
  if (reporters < AUTO_HIDE_REPORTERS) return;
  await db.batch([
    db.stmt("UPDATE lost_posts SET status = 'hidden', updated_at = ? WHERE id = ? AND status = 'active'", ts, postId),
    db.stmt("UPDATE found_posts SET status = 'hidden', updated_at = ? WHERE id = ? AND status = 'active'", ts, postId),
  ]);
}

misc.post('/users/:userId/block', async c => {
  const user = await currentUser(c);
  const userId = c.req.param('userId');
  if (userId === user.id) throw new AppError(400, 'BLOCK_SELF', 'Cannot block yourself');
  const {db} = deps(c);
  if (!(await db.get('users', userId))) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  await db.run(
    'INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
    uuid(),
    user.id,
    userId,
    now(),
  );
  return c.json(success({blocked: true, user_id: userId}), 201);
});

misc.delete('/users/:userId/block', async c => {
  const user = await currentUser(c);
  await deps(c).db.run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, c.req.param('userId'));
  return c.body(null, 204);
});

misc.get('/users/me/blocks', async c => {
  const user = await currentUser(c);
  const rows = await deps(c).db.all<Row>('SELECT * FROM user_blocks WHERE blocker_id = ? ORDER BY created_at, rowid', user.id);
  return c.json(success(rows.map(r => ({id: r.id, blocked_id: r.blocked_id, created_at: r.created_at}))));
});
