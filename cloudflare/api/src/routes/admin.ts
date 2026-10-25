import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, type AppEnv, type Ctx, type User} from '../app';
import {uuid, type Row} from '../lib/db';
import {tokenUrlsafe} from '../lib/encoding';
import {AppError, success} from '../lib/errors';
import {ADMIN, isStaff, SUPER_ADMIN, USER} from '../lib/roles';
import {bool, foundPostRead, lostPostRead, petSummary, reportRead, staffPrivate, userRead} from '../lib/serialize';
import {deleteUrl, publicUrl} from '../services/storage';
import {now} from '../lib/time';
import {bool as boolField, datetime, int, num, optStr, parseBody, parseQuery, photoList, str} from '../lib/validate';
import {dispatchFoundAlerts, dispatchLostAlerts} from '../services/notifications';
import {uniquePetCode, uniqueQrToken} from '../services/pets';
import {listOwnership, reviewOwnership} from './pets';
import {photoColumns} from './posts';

const RoleUpdate = z.object({role: z.string()});
const ReportResolve = z.object({
  status: z.enum(['resolved', 'dismissed', 'action_taken']),
  resolver_note: optStr(2000),
});

async function requireAdmin(c: Ctx): Promise<User> {
  const user = await currentUser(c);
  if (!isStaff(user.role)) throw new AppError(403, 'AUTH_FORBIDDEN', 'Admin role required');
  return user;
}

async function requireSuperAdmin(c: Ctx): Promise<User> {
  const user = await currentUser(c);
  if (user.role !== SUPER_ADMIN) throw new AppError(403, 'AUTH_FORBIDDEN', 'Super admin role required');
  return user;
}

async function userOr404(c: Ctx, id: string): Promise<User> {
  const user = await deps(c).db.get<User>('users', id);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return user;
}

function setUserPostsStatus(c: Ctx, userId: string, from: string, to: string) {
  const {db} = deps(c);
  const ts = now();
  return [
    db.stmt('UPDATE lost_posts SET status = ?, updated_at = ? WHERE owner_id = ? AND status = ?', to, ts, userId, from),
    db.stmt('UPDATE found_posts SET status = ?, updated_at = ? WHERE reporter_id = ? AND status = ?', to, ts, userId, from),
  ];
}

export const admin = new Hono<AppEnv>().basePath('/admin');

admin.get('/metrics', async c => {
  await requireAdmin(c);
  const {db} = deps(c);
  const [users, lost, found, reports, ownership, flagged] = await Promise.all([
    db.count('SELECT COUNT(*) FROM users'),
    db.count("SELECT COUNT(*) FROM lost_posts WHERE status = 'active'"),
    db.count("SELECT COUNT(*) FROM found_posts WHERE status = 'active'"),
    db.count("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
    db.count("SELECT COUNT(*) FROM ownership_verifications WHERE status = 'pending'"),
    db.count("SELECT COUNT(*) FROM image_moderation WHERE verdict = 'flagged'"),
  ]);
  return c.json(
    success({users, lost_active: lost, found_active: found, reports_open: reports, ownership_pending: ownership, images_flagged: flagged}),
  );
});

const UsersQuery = z.object({
  q: z.string().max(120).optional(),
  page: int().pipe(z.number().min(1)).default(1),
  page_size: int().pipe(z.number().min(1).max(100)).default(20),
});

admin.get('/users', async c => {
  await requireAdmin(c);
  const q = parseQuery(c, UsersQuery);
  const {db} = deps(c);
  let where = '';
  const params: string[] = [];
  if (q.q && q.q.trim()) {
    const term = `%${q.q.trim().toLowerCase()}%`;
    where = 'WHERE lower(email) LIKE ? OR lower(display_name) LIKE ?';
    params.push(term, term);
  }
  const total = await db.count(`SELECT COUNT(*) FROM users ${where}`, ...params);
  const rows = await db.all<Row>(
    `SELECT * FROM users ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    ...params,
    q.page_size,
    (q.page - 1) * q.page_size,
  );
  return c.json(success({items: rows.map(userRead), total, page: q.page, page_size: q.page_size}));
});

admin.post('/users/:userId/block', async c => {
  const actor = await requireSuperAdmin(c);
  const user = await userOr404(c, c.req.param('userId'));
  if (user.id === actor.id) throw new AppError(409, 'CANNOT_BLOCK_SELF', 'You cannot block yourself');
  if (user.role === SUPER_ADMIN) throw new AppError(403, 'AUTH_FORBIDDEN', 'Super admins cannot be blocked');
  const {db} = deps(c);
  const ts = now();
  await db.batch([
    db.stmt("UPDATE users SET is_active = 0, status = 'blocked', updated_at = ? WHERE id = ?", ts, user.id),
    db.stmt('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', ts, user.id),
    ...setUserPostsStatus(c, user.id, 'active', 'hidden'),
  ]);
  return c.json(success(userRead({...user, is_active: 0, status: 'blocked'})));
});

admin.post('/users/:userId/unblock', async c => {
  await requireSuperAdmin(c);
  const user = await userOr404(c, c.req.param('userId'));
  const {db} = deps(c);
  await db.batch([
    db.stmt("UPDATE users SET is_active = 1, status = 'active', updated_at = ? WHERE id = ?", now(), user.id),
    ...setUserPostsStatus(c, user.id, 'hidden', 'active'),
  ]);
  return c.json(success(userRead({...user, is_active: 1, status: 'active'})));
});

admin.post('/users/:userId/role', async c => {
  const actor = await requireSuperAdmin(c);
  const body = await parseBody(c, RoleUpdate);
  if (body.role !== USER && body.role !== ADMIN) throw new AppError(422, 'INVALID_ROLE', 'Role must be user or admin');
  const user = await userOr404(c, c.req.param('userId'));
  if (user.id === actor.id || user.role === SUPER_ADMIN) {
    throw new AppError(403, 'AUTH_FORBIDDEN', 'Super admin role cannot be changed here');
  }
  await deps(c).db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', body.role, now(), user.id);
  return c.json(success(userRead({...user, role: body.role})));
});

admin.get('/ownership-verifications', async c => {
  await requireAdmin(c);
  return listOwnership(c);
});

admin.post('/ownership-verifications/:verificationId/review', async c => {
  await requireAdmin(c);
  return reviewOwnership(c);
});

admin.get('/reports', async c => {
  await requireAdmin(c);
  const params = new URL(c.req.url).searchParams;
  const status = params.has('status') ? params.get('status') : 'open';
  const {db} = deps(c);
  const rows = status
    ? await db.all<Row>('SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT 200', status)
    : await db.all<Row>('SELECT * FROM reports ORDER BY created_at DESC LIMIT 200');
  return c.json(success(rows.map(reportRead)));
});

admin.post('/reports/:reportId/resolve', async c => {
  const actor = await requireAdmin(c);
  const body = await parseBody(c, ReportResolve);
  const {db} = deps(c);
  const id = c.req.param('reportId');
  const row = await db.get<Row>('reports', id);
  if (!row) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  const fields = {status: body.status, resolver_note: body.resolver_note ?? null, resolver_id: actor.id, resolved_at: now()};
  await db.update('reports', id, fields);
  return c.json(success(reportRead({...row, ...fields})));
});

admin.get('/lost-posts', async c => {
  await requireAdmin(c);
  const rows = await deps(c).db.all<Row>('SELECT * FROM lost_posts ORDER BY created_at DESC LIMIT 200');
  return c.json(success(rows.map(lostPostRead)));
});

admin.get('/found-posts', async c => {
  await requireAdmin(c);
  const rows = await deps(c).db.all<Row>('SELECT * FROM found_posts ORDER BY created_at DESC LIMIT 200');
  return c.json(success(rows.map(foundPostRead)));
});

const POST_STATUSES = ['active', 'resolved', 'cancelled', 'closed', 'hidden', 'removed'] as const;
const OPEN_STATUSES = ['active', 'hidden'];

const PostHistoryQuery = z.object({
  kind: z.enum(['lost', 'found']),
  status: z.enum(POST_STATUSES).optional(),
  q: z.string().max(120).optional(),
  page: int().pipe(z.number().min(1)).default(1),
  page_size: int().pipe(z.number().min(1).max(100)).default(20),
});

admin.get('/posts', async c => {
  await requireAdmin(c);
  const q = parseQuery(c, PostHistoryQuery);
  const {db} = deps(c);
  const lost = q.kind === 'lost';
  const conds: string[] = [];
  const params: string[] = [];
  if (q.status) {
    conds.push(lost ? 'l.status = ?' : 'status = ?');
    params.push(q.status);
  }
  const term = q.q?.trim().toLowerCase();
  if (term) {
    const cols = lost ? ['p.name', 'l.title', 'l.location_text'] : ['location_text', 'breed_guess', 'color', 'description'];
    conds.push(`(${cols.map(col => `lower(COALESCE(${col}, '')) LIKE ?`).join(' OR ')})`);
    params.push(...cols.map(() => `%${term}%`));
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const from = lost ? 'lost_posts l LEFT JOIN pets p ON p.id = l.pet_id' : 'found_posts';
  const total = await db.count(`SELECT COUNT(*) FROM ${from} ${where}`, ...params);
  const select = lost ? 'SELECT l.*, p.id AS p_id, p.name AS p_name, p.animal_type AS p_animal_type, p.profile_image_url AS p_profile_image_url' : 'SELECT *';
  const rows = await db.all<Row>(
    `${select} FROM ${from} ${where} ORDER BY ${lost ? 'l.' : ''}created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    q.page_size,
    (q.page - 1) * q.page_size,
  );
  const items = rows.map(r =>
    lost ? {...lostPostRead(r), pet: r.p_id ? {id: r.p_id, name: r.p_name, animal_type: r.p_animal_type, profile_image_url: r.p_profile_image_url ?? null} : null} : foundPostRead(r),
  );
  return c.json(success({items, total, page: q.page, page_size: q.page_size}));
});

const PostStatusUpdate = z.object({status: z.enum(POST_STATUSES)});

async function setPostStatus(c: Ctx, kind: 'lost' | 'found') {
  const actor = await requireAdmin(c);
  const {status} = await parseBody(c, PostStatusUpdate);
  const {db} = deps(c);
  const table = kind === 'lost' ? 'lost_posts' : 'found_posts';
  const post = await db.get<Row>(table, c.req.param('postId')!);
  if (!post) {
    throw kind === 'lost'
      ? new AppError(404, 'LOST_POST_NOT_FOUND', 'Lost post not found')
      : new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  }
  if ((status === 'hidden' || post.status === 'hidden') && actor.role !== SUPER_ADMIN) {
    throw new AppError(403, 'AUTH_FORBIDDEN', 'Super admin role required');
  }
  if (status === post.status) return c.json(success(kind === 'lost' ? lostPostRead(post) : foundPostRead(post)));
  const ts = now();
  const open = OPEN_STATUSES.includes(status);

  if (kind === 'found') {
    await db.run('UPDATE found_posts SET status = ?, updated_at = ? WHERE id = ?', status, ts, String(post.id));
    return c.json(success(foundPostRead({...post, status, updated_at: ts})));
  }

  const petId = String(post.pet_id);
  if (open && !OPEN_STATUSES.includes(String(post.status))) {
    const other = await db.one(
      "SELECT id FROM lost_posts WHERE pet_id = ? AND id != ? AND status IN ('active', 'hidden')",
      petId,
      String(post.id),
    );
    if (other) throw new AppError(409, 'LOST_POST_ALREADY_ACTIVE', 'This pet already has an open lost post');
  }
  const fields = open
    ? {status, closed_at: null, checkin_asked_at: null, checkin_base_at: OPEN_STATUSES.includes(String(post.status)) ? post.checkin_base_at : ts}
    : {status, closed_at: post.closed_at ?? ts, checkin_asked_at: null};
  await db.batch([
    db.stmt(
      `UPDATE lost_posts SET ${Object.keys(fields).map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...(Object.values(fields) as (string | null)[]),
      ts,
      String(post.id),
    ),
    open
      ? db.stmt("UPDATE pets SET status = 'lost', updated_at = ? WHERE id = ?", ts, petId)
      : db.stmt("UPDATE pets SET status = 'normal', updated_at = ? WHERE id = ? AND status = 'lost'", ts, petId),
  ]);
  return c.json(success(lostPostRead({...post, ...fields, updated_at: ts})));
}

admin.post('/lost-posts/:postId/status', c => setPostStatus(c, 'lost'));
admin.post('/found-posts/:postId/status', c => setPostStatus(c, 'found'));

admin.post('/lost-posts/:postId/close', async c => {
  await requireAdmin(c);
  const {db} = deps(c);
  const post = await db.get<Row>('lost_posts', c.req.param('postId'));
  if (!post) throw new AppError(404, 'LOST_POST_NOT_FOUND', 'Lost post not found');
  const ts = now();
  await db.batch([
    db.stmt("UPDATE lost_posts SET status = 'removed', closed_at = ?, updated_at = ? WHERE id = ?", ts, ts, String(post.id)),
    db.stmt("UPDATE pets SET status = 'normal', updated_at = ? WHERE id = ?", ts, String(post.pet_id)),
  ]);
  return c.json(success(lostPostRead({...post, status: 'removed', closed_at: ts})));
});

admin.post('/found-posts/:postId/close', async c => {
  await requireAdmin(c);
  const {db} = deps(c);
  const post = await db.get<Row>('found_posts', c.req.param('postId'));
  if (!post) throw new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  await db.run("UPDATE found_posts SET status = 'removed', updated_at = ? WHERE id = ?", now(), String(post.id));
  return c.json(success(foundPostRead({...post, status: 'removed'})));
});

async function toggle(c: Ctx, table: 'lost_posts' | 'found_posts', hidden: boolean) {
  await requireSuperAdmin(c);
  const {db} = deps(c);
  const post = await db.get<Row>(table, c.req.param('postId')!);
  if (!post) {
    throw table === 'lost_posts'
      ? new AppError(404, 'LOST_POST_NOT_FOUND', 'Lost post not found')
      : new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  }
  if (hidden && post.status !== 'active') throw new AppError(409, 'POST_NOT_ACTIVE', 'Only active posts can be hidden');
  if (!hidden && post.status !== 'hidden') throw new AppError(409, 'POST_NOT_HIDDEN', 'Post is not hidden');
  const status = hidden ? 'hidden' : 'active';
  await db.run(`UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ?`, status, now(), String(post.id));
  const updated = {...post, status};
  return c.json(success(table === 'lost_posts' ? lostPostRead(updated) : foundPostRead(updated)));
}

admin.post('/found-posts/:postId/block-guest', async c => {
  const actor = await requireAdmin(c);
  const {db} = deps(c);
  const post = await db.get<Row>('found_posts', c.req.param('postId'));
  if (!post) throw new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  if (!post.reporter_ip_hash) throw new AppError(409, 'NOT_GUEST_POST', 'Only guest posts can be blocked this way');
  const hash = String(post.reporter_ip_hash);
  const ts = now();
  const [, removed] = await db.batch([
    db.stmt('INSERT OR IGNORE INTO guest_blocks (ip_hash, reason, blocked_by, created_at) VALUES (?, ?, ?, ?)', hash, `post ${post.id}`, actor.id, ts),
    db.stmt("UPDATE found_posts SET status = 'removed', updated_at = ? WHERE reporter_ip_hash = ? AND status IN ('active', 'hidden')", ts, hash),
  ]);
  return c.json(success({blocked: true, removed_posts: removed.meta.changes ?? 0}));
});

function imageFlagRead(env: Env, r: Row) {
  return {
    id: r.id,
    url: r.filename ? publicUrl(env, String(r.filename)) : null,
    verdict: r.verdict,
    reason: r.reason,
    is_guest: bool(r.is_guest),
    uploader_id: r.uploader_id ?? null,
    created_at: r.created_at,
  };
}

admin.get('/image-flags', async c => {
  await requireAdmin(c);
  const rows = await deps(c).db.all<Row>(
    "SELECT * FROM image_moderation WHERE verdict IN ('flagged', 'rejected') ORDER BY created_at DESC LIMIT 100",
  );
  return c.json(success(rows.map(r => imageFlagRead(c.env, r))));
});

async function reviewImage(c: Ctx, remove: boolean) {
  await requireAdmin(c);
  const {db} = deps(c);
  const row = await db.get<Row>('image_moderation', c.req.param('flagId'));
  if (!row) throw new AppError(404, 'IMAGE_FLAG_NOT_FOUND', 'Image flag not found');
  if (remove && row.filename) await deleteUrl(c.env, publicUrl(c.env, String(row.filename)));
  const verdict = remove ? 'removed' : 'reviewed';
  await db.run('UPDATE image_moderation SET verdict = ? WHERE id = ?', verdict, String(row.id));
  return c.json(success(imageFlagRead(c.env, {...row, verdict})));
}

admin.post('/image-flags/:flagId/approve', c => reviewImage(c, false));
admin.post('/image-flags/:flagId/remove', c => reviewImage(c, true));

admin.post('/lost-posts/:postId/hide', c => toggle(c, 'lost_posts', true));
admin.post('/lost-posts/:postId/unhide', c => toggle(c, 'lost_posts', false));
admin.post('/found-posts/:postId/hide', c => toggle(c, 'found_posts', true));
admin.post('/found-posts/:postId/unhide', c => toggle(c, 'found_posts', false));

const lat = () => num().pipe(z.number().min(-90).max(90));
const lng = () => num().pipe(z.number().min(-180).max(180));
const intakePrivate = {
  private_owner_name: str(160, 1),
  private_phone: str(40, 1),
  private_link: optStr(500),
  private_note: optStr(4000),
};

const AdminLostIntake = z.object({
  name: str(120, 1),
  animal_type: z.enum(['dog', 'cat', 'other']),
  breed: optStr(120),
  gender: optStr(30),
  color: optStr(120),
  distinctive_marks: optStr(),
  lost_at: datetime(),
  latitude: lat(),
  longitude: lng(),
  location_text: optStr(300),
  search_radius_km: num().pipe(z.number().gt(0).max(100)).default(5),
  description: optStr(),
  reward_enabled: boolField().default(false),
  reward_text: optStr(300),
  image_urls: photoList().default([]),
  ...intakePrivate,
});

const AdminFoundIntake = z.object({
  animal_type: z.enum(['dog', 'cat', 'other']),
  breed_guess: optStr(120),
  color: optStr(120),
  description: optStr(),
  found_at: datetime(),
  latitude: lat(),
  longitude: lng(),
  location_text: optStr(300),
  image_urls: photoList().default([]),
  ...intakePrivate,
});

function blankToNull(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function privateColumns(body: {
  private_owner_name: string;
  private_phone: string;
  private_link?: string | null;
  private_note?: string | null;
}) {
  const phone = body.private_phone.replace(/[^\d+]/g, '');
  const owner = body.private_owner_name.trim();
  if (!owner) throw new AppError(400, 'INVALID_OWNER', 'กรอกชื่อเจ้าของ');
  if (phone.replace(/\D/g, '').length < 8) {
    throw new AppError(400, 'INVALID_PHONE', 'เบอร์โทรสั้นเกินไป');
  }
  return {
    created_by_admin: 1,
    private_owner_name: owner,
    private_phone: phone,
    private_link: blankToNull(body.private_link),
    private_note: blankToNull(body.private_note),
  };
}

admin.post('/intake/lost', async c => {
  const user = await requireAdmin(c);
  const body = await parseBody(c, AdminLostIntake);
  const d = deps(c);
  const ts = now();
  const photos = photoColumns(body.image_urls);
  const pet: Row = {
    id: uuid(),
    owner_id: user.id,
    pet_code: await uniquePetCode(d),
    qr_token: await uniqueQrToken(d),
    name: body.name.trim(),
    animal_type: body.animal_type,
    breed: blankToNull(body.breed),
    gender: blankToNull(body.gender),
    color: blankToNull(body.color),
    distinctive_marks: blankToNull(body.distinctive_marks),
    profile_image_url: photos.image_url,
    status: 'lost',
    is_public: 0,
    created_at: ts,
    updated_at: ts,
  };
  const post: Row = {
    id: uuid(),
    pet_id: pet.id,
    owner_id: user.id,
    status: 'active',
    title: `ตามหา ${pet.name}`,
    description: blankToNull(body.description),
    lost_at: body.lost_at,
    latitude: body.latitude,
    longitude: body.longitude,
    location_text: blankToNull(body.location_text),
    search_radius_km: body.search_radius_km,
    reward_enabled: body.reward_enabled ? 1 : 0,
    reward_text: body.reward_enabled ? blankToNull(body.reward_text) : null,
    ...photos,
    share_token: tokenUrlsafe(24),
    created_at: ts,
    updated_at: ts,
    ...privateColumns(body),
  };
  await d.db.batch([
    d.db.insertStmt('pets', pet as Record<string, string | number | null>),
    d.db.insertStmt('lost_posts', post as Record<string, string | number | null>),
    d.db.insertStmt('lost_case_followers', {id: uuid(), lost_post_id: String(post.id), user_id: user.id, created_at: ts}),
  ]);
  await dispatchLostAlerts(d, post, pet);
  return c.json(success({...lostPostRead(post), ...staffPrivate(post), pet: petSummary(pet)}), 201);
});

admin.post('/intake/found', async c => {
  const user = await requireAdmin(c);
  const body = await parseBody(c, AdminFoundIntake);
  const d = deps(c);
  const ts = now();
  const post: Row = {
    id: uuid(),
    reporter_id: user.id,
    share_token: tokenUrlsafe(24),
    animal_type: body.animal_type,
    breed_guess: blankToNull(body.breed_guess),
    color: blankToNull(body.color),
    description: blankToNull(body.description),
    found_at: body.found_at,
    latitude: body.latitude,
    longitude: body.longitude,
    location_text: blankToNull(body.location_text),
    ...photoColumns(body.image_urls),
    status: 'active',
    is_guest: 0,
    created_at: ts,
    updated_at: ts,
    ...privateColumns(body),
  };
  await d.db.insert('found_posts', post as Record<string, string | number | null>);
  await dispatchFoundAlerts(d, post);
  return c.json(success({...foundPostRead(post), ...staffPrivate(post)}), 201);
});
