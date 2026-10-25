import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, deps, optionalUser, type AppEnv, type Ctx, type User} from '../app';
import {uuid, type Db, type Row} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {haversineKm, round2} from '../lib/geo';
import {isOlder, makeCursor, parseCursor} from '../lib/pagination';
import {isStaff, PRIVATE_POST_STATUSES} from '../lib/roles';
import {bool, conversationRead, foundPostRead, lostPostRead, petSummary, sightingRead, staffPrivate} from '../lib/serialize';
import {addMs, DAY_MS, formatDayMonYear, now} from '../lib/time';
import {tokenUrlsafe} from '../lib/encoding';
import {bool as boolField, datetime, int, num, optStr, parseBody, parseQuery, photoList} from '../lib/validate';
import {findOrCreateConversation} from '../services/chat';
import {answerCheckin, closeLostPost} from '../services/lostCheckin';
import {dispatchFoundAlerts, dispatchLostAlerts, notifyPetGuardians, notifySighting} from '../services/notifications';
import {matchesPetOption} from '../services/petOptions';
import {getOwnedPet} from '../services/pets';
import {generateShareCard} from '../services/shareCard';
import {prefixed} from './users';

const MAX_POST_PHOTOS = 3;
const lat = () => num().pipe(z.number().min(-90).max(90));
const lng = () => num().pipe(z.number().min(-180).max(180));

const LostPostCreate = z.object({
  pet_id: z.string(),
  lost_at: datetime(),
  latitude: lat(),
  longitude: lng(),
  location_text: optStr(300),
  search_radius_km: num().pipe(z.number().gt(0).max(100)).default(5),
  description: optStr(),
  reward_enabled: boolField().default(false),
  reward_text: optStr(300),
  image_url: optStr(1000),
  image_urls: photoList().default([]),
});
const LostPostUpdate = z.object({
  lost_at: datetime().nullish(),
  latitude: lat().nullish(),
  longitude: lng().nullish(),
  description: optStr(),
  location_text: optStr(300),
  search_radius_km: num().pipe(z.number().gt(0).max(100)).nullish(),
  reward_enabled: boolField().nullish(),
  reward_text: optStr(),
  image_url: optStr(),
  image_urls: photoList().nullish(),
});
const LostCheckinAnswer = z.object({found: boolField()});
const animal = () => z.enum(['dog', 'cat', 'other']);
const FoundPostCreate = z.object({
  animal_type: animal(),
  breed_guess: optStr(),
  color: optStr(),
  description: optStr(),
  image_url: optStr(),
  image_urls: photoList().default([]),
  found_at: datetime(),
  latitude: lat(),
  longitude: lng(),
  location_text: optStr(),
});
const FoundPostUpdate = z.object({
  animal_type: animal().nullish(),
  breed_guess: optStr(),
  color: optStr(),
  description: optStr(),
  image_url: optStr(),
  image_urls: photoList().nullish(),
  found_at: datetime().nullish(),
  latitude: lat().nullish(),
  longitude: lng().nullish(),
  location_text: optStr(),
});
const SightingCreate = z.object({
  seen_at: datetime(),
  latitude: lat(),
  longitude: lng(),
  location_text: optStr(),
  direction: optStr(),
  description: optStr(),
  image_url: optStr(),
  image_urls: photoList().default([]),
});

/** image_url stays the cover photo so single-image readers keep working. */
export function photoColumns(urls: (string | null | undefined)[]) {
  const images = [...new Set(urls.filter((u): u is string => !!u))].slice(0, MAX_POST_PHOTOS);
  return {image_url: images[0] ?? null, image_urls: images.length ? JSON.stringify(images) : null};
}

/** Pops photo keys from a PATCH payload and returns the columns to write (an empty image_urls clears all photos). */
function photoUpdate(fields: Record<string, unknown>) {
  const urls = fields.image_urls as string[] | null | undefined;
  const single = fields.image_url as string | null | undefined;
  delete fields.image_urls;
  delete fields.image_url;
  if (urls != null) return photoColumns(urls);
  if (single) return photoColumns([single]);
  return {};
}

const LOST_WITH_PET = `SELECT l.*, p.id AS p_id, p.name AS p_name, p.animal_type AS p_animal_type, p.breed AS p_breed,
  p.color AS p_color, p.profile_image_url AS p_profile_image_url, p.distinctive_marks AS p_distinctive_marks
  FROM lost_posts l JOIN pets p ON p.id = l.pet_id`;

export function lostPostListItem(row: Row) {
  return {...lostPostRead(row), pet: petSummary(prefixed(row, 'p_'))};
}

async function lostPostOr404(db: Db, id: string): Promise<Row> {
  const post = await db.get<Row>('lost_posts', id);
  if (!post) throw new AppError(404, 'LOST_POST_NOT_FOUND', 'Lost post not found');
  return post;
}

const canSeePrivate = (viewer: User | null, ownerId: unknown) => !!viewer && (viewer.id === ownerId || isStaff(viewer.role));

async function visibleLostPostOr404(db: Db, id: string, viewer: User | null): Promise<Row> {
  const post = await lostPostOr404(db, id);
  if (PRIVATE_POST_STATUSES.includes(String(post.status)) && !canSeePrivate(viewer, post.owner_id)) {
    throw new AppError(404, 'LOST_POST_NOT_FOUND', 'Lost post not found');
  }
  return post;
}

async function visibleFoundPostOr404(db: Db, id: string, viewer: User | null): Promise<Row> {
  const post = await db.get<Row>('found_posts', id);
  if (!post || (PRIVATE_POST_STATUSES.includes(String(post.status)) && !canSeePrivate(viewer, post.reporter_id))) {
    throw new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  }
  return post;
}

/** Authors opening their own post don't count; the web client sends this once per browser session. */
async function recordView(db: Db, table: 'lost_posts' | 'found_posts', post: Row, authorId: unknown, viewer: User | null) {
  if (viewer && viewer.id === authorId) return Number(post.view_count ?? 0);
  return db.count(`UPDATE ${table} SET view_count = view_count + 1 WHERE id = ? RETURNING view_count`, String(post.id));
}

const ListQuery = z.object({status: z.string().default('active'), animal_type: z.string().optional()});

export const posts = new Hono<AppEnv>();

// ---------- Lost posts ----------

posts.get('/lost-posts', async c => {
  const q = parseQuery(c, ListQuery);
  if (PRIVATE_POST_STATUSES.includes(q.status)) return c.json(success([]));
  const params: string[] = [q.status];
  let sql = `${LOST_WITH_PET} WHERE l.status = ?`;
  if (q.animal_type) {
    sql += ' AND p.animal_type = ?';
    params.push(q.animal_type);
  }
  const rows = await deps(c).db.all<Row>(`${sql} ORDER BY l.created_at DESC LIMIT 100`, ...params);
  return c.json(success(rows.map(lostPostListItem)));
});

posts.get('/lost-posts/:postId', async c => {
  const viewer = await optionalUser(c);
  const {db} = deps(c);
  const post = await visibleLostPostOr404(db, c.req.param('postId'), viewer);
  const pet = await db.get<Row>('pets', String(post.pet_id));
  const item: Record<string, unknown> = lostPostRead(post);
  if (pet) item.pet = {...petSummary(pet), distinctive_marks: pet.distinctive_marks ?? null};
  if (viewer && isStaff(viewer.role) && bool(post.created_by_admin)) Object.assign(item, staffPrivate(post));
  return c.json(success(item));
});

posts.post('/lost-posts/:postId/view', async c => {
  const viewer = await optionalUser(c);
  const {db} = deps(c);
  const post = await visibleLostPostOr404(db, c.req.param('postId'), viewer);
  return c.json(success({view_count: await recordView(db, 'lost_posts', post, post.owner_id, viewer)}));
});

posts.post('/lost-posts', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, LostPostCreate);
  const d = deps(c);
  const pet = await getOwnedPet(d, user, body.pet_id);
  if (await d.db.one("SELECT id FROM lost_posts WHERE pet_id = ? AND status = 'active'", String(pet.id))) {
    throw new AppError(409, 'LOST_POST_ALREADY_ACTIVE', 'This pet already has an active lost post');
  }
  const ts = now();
  const post: Row = {
    id: uuid(),
    pet_id: pet.id,
    owner_id: user.id,
    status: 'active',
    title: `ตามหา ${pet.name}`,
    description: body.description ?? null,
    lost_at: body.lost_at,
    latitude: body.latitude,
    longitude: body.longitude,
    location_text: body.location_text ?? null,
    search_radius_km: body.search_radius_km,
    reward_enabled: body.reward_enabled ? 1 : 0,
    reward_text: body.reward_text ?? null,
    ...photoColumns([...body.image_urls, body.image_url]),
    share_token: tokenUrlsafe(24),
    created_at: ts,
    updated_at: ts,
    closed_at: null,
    checkin_base_at: null,
    checkin_asked_at: null,
  };
  await d.db.batch([
    d.db.insertStmt('lost_posts', post as Record<string, string | number | null>),
    d.db.stmt("UPDATE pets SET status = 'lost', updated_at = ? WHERE id = ?", ts, String(pet.id)),
    d.db.insertStmt('lost_case_followers', {id: uuid(), lost_post_id: String(post.id), user_id: user.id, created_at: ts}),
  ]);
  await dispatchLostAlerts(d, post, pet);
  await notifyPetGuardians(
    d,
    String(pet.id),
    'guardian_lost_alert',
    `${pet.name} ถูกแจ้งหาย 🔴`,
    `เจ้าของได้เปิดเคสตามหา ${pet.name} แล้ว`,
    'lost_post',
    String(post.id),
    user.id,
  );
  return c.json(success(lostPostRead(post)), 201);
});

posts.patch('/lost-posts/:postId', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, LostPostUpdate);
  const d = deps(c);
  const post = await lostPostOr404(d.db, c.req.param('postId'));
  if (post.owner_id !== user.id) throw new AppError(403, 'AUTH_FORBIDDEN', 'Only the owner can edit this lost post');
  if (post.status !== 'active') throw new AppError(409, 'LOST_POST_ALREADY_RESOLVED', 'Lost post is not active');
  const fields: Record<string, unknown> = {...body};
  Object.assign(fields, photoUpdate(fields));
  const update: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (['lost_at', 'latitude', 'longitude', 'search_radius_km', 'reward_enabled'].includes(key) && value === null) continue;
    update[key] = value as string | number | boolean | null;
  }
  if (Object.keys(update).length) {
    update.updated_at = now();
    await d.db.update('lost_posts', String(post.id), update);
  }
  return c.json(success(lostPostRead({...post, ...update})));
});

async function ownerActionLost(c: Ctx, action: string) {
  const user = await currentUser(c);
  const d = deps(c);
  const post = await lostPostOr404(d.db, c.req.param('postId')!);
  if (post.owner_id !== user.id) throw new AppError(403, 'AUTH_FORBIDDEN', `Only the owner can ${action}`);
  if (post.status !== 'active') throw new AppError(409, 'LOST_POST_ALREADY_RESOLVED', 'Lost post is not active');
  return {d, post};
}

posts.post('/lost-posts/:postId/resolve', async c => {
  const {d, post} = await ownerActionLost(c, 'resolve this lost post');
  await closeLostPost(d, post, 'resolved');
  return c.json(success(lostPostRead(post), 'Pet marked as found'));
});

posts.post('/lost-posts/:postId/checkin', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, LostCheckinAnswer);
  const d = deps(c);
  const post = await lostPostOr404(d.db, c.req.param('postId'));
  if (post.owner_id !== user.id) throw new AppError(403, 'AUTH_FORBIDDEN', 'Only the owner can answer this check-in');
  if (post.status !== 'active') throw new AppError(409, 'LOST_POST_ALREADY_RESOLVED', 'Lost post is not active');
  await answerCheckin(d, post, body.found);
  return c.json(success(lostPostRead(post)));
});

posts.post('/lost-posts/:postId/cancel', async c => {
  const {d, post} = await ownerActionLost(c, 'cancel this lost post');
  await closeLostPost(d, post, 'cancelled');
  return c.json(success(lostPostRead(post)));
});

posts.post('/lost-posts/:postId/contact', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const post = await visibleLostPostOr404(d.db, c.req.param('postId'), user);
  const conversation = await findOrCreateConversation(d, user, String(post.owner_id), 'lost_found', String(post.id));
  return c.json(success(conversationRead(conversation)), 201);
});

posts.post('/lost-posts/:postId/share-card', async c => {
  await currentUser(c);
  const d = deps(c);
  const post = await lostPostOr404(d.db, c.req.param('postId'));
  const pet = await d.db.get<Row>('pets', String(post.pet_id));
  const subtitle = pet ? `${pet.breed || pet.animal_type} · ${pet.color || ''}` : ' · ';
  const url = await generateShareCard(d.env, {
    kind: 'lost',
    title: String(pet ? pet.name : post.title),
    subtitle: subtitle.trim().replace(/^[ ·]+|[ ·]+$/g, ''),
    location: (post.location_text as string) || `${Number(post.latitude).toFixed(4)}, ${Number(post.longitude).toFixed(4)}`,
    dateText: formatDayMonYear(String(post.lost_at)),
    keySuffix: `lost-${post.id}`,
  });
  return c.json(success({url, share_url: `/lost/${post.share_token}`}));
});

// ---------- Found posts ----------

posts.get('/found-posts', async c => {
  const q = parseQuery(c, ListQuery);
  if (PRIVATE_POST_STATUSES.includes(q.status)) return c.json(success([]));
  const params: string[] = [q.status];
  let sql = 'SELECT * FROM found_posts WHERE status = ?';
  if (q.animal_type) {
    sql += ' AND animal_type = ?';
    params.push(q.animal_type);
  }
  const rows = await deps(c).db.all<Row>(`${sql} ORDER BY created_at DESC LIMIT 100`, ...params);
  return c.json(success(rows.map(foundPostRead)));
});

posts.get('/found-posts/:postId', async c => {
  const viewer = await optionalUser(c);
  const post = await visibleFoundPostOr404(deps(c).db, c.req.param('postId'), viewer);
  const item: Record<string, unknown> = foundPostRead(post);
  if (viewer && isStaff(viewer.role) && bool(post.created_by_admin)) Object.assign(item, staffPrivate(post));
  return c.json(success(item));
});

posts.post('/found-posts/:postId/view', async c => {
  const viewer = await optionalUser(c);
  const {db} = deps(c);
  const post = await visibleFoundPostOr404(db, c.req.param('postId'), viewer);
  return c.json(success({view_count: await recordView(db, 'found_posts', post, post.reporter_id, viewer)}));
});

posts.post('/found-posts', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, FoundPostCreate);
  const d = deps(c);
  const ts = now();
  const post: Row = {
    id: uuid(),
    reporter_id: user.id,
    share_token: tokenUrlsafe(24),
    animal_type: body.animal_type,
    breed_guess: body.breed_guess ?? null,
    color: body.color ?? null,
    description: body.description ?? null,
    found_at: body.found_at,
    latitude: body.latitude,
    longitude: body.longitude,
    location_text: body.location_text ?? null,
    ...photoColumns([...body.image_urls, body.image_url]),
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };
  await d.db.insert('found_posts', post as Record<string, string | number | null>);
  await dispatchFoundAlerts(d, post);
  return c.json(success(foundPostRead(post)), 201);
});

posts.patch('/found-posts/:postId', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, FoundPostUpdate);
  const d = deps(c);
  const post = await d.db.get<Row>('found_posts', c.req.param('postId'));
  if (!post) throw new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  if (post.reporter_id !== user.id) throw new AppError(403, 'AUTH_FORBIDDEN', 'Only the reporter can edit this post');
  if (post.status !== 'active') throw new AppError(409, 'FOUND_POST_NOT_ACTIVE', 'Found post is not active');
  const fields: Record<string, unknown> = {...body};
  Object.assign(fields, photoUpdate(fields));
  const update: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (['animal_type', 'found_at', 'latitude', 'longitude'].includes(key) && value === null) continue;
    update[key] = value as string | number | null;
  }
  if (Object.keys(update).length) {
    update.updated_at = now();
    await d.db.update('found_posts', String(post.id), update);
  }
  return c.json(success(foundPostRead({...post, ...update})));
});

async function closeFoundPost(c: Ctx, status: string) {
  const user = await currentUser(c);
  const d = deps(c);
  const post = await d.db.get<Row>('found_posts', c.req.param('postId')!);
  if (!post) throw new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  if (post.reporter_id !== user.id) throw new AppError(403, 'AUTH_FORBIDDEN', 'Only the reporter can close this post');
  if (post.status !== 'active') throw new AppError(409, 'FOUND_POST_NOT_ACTIVE', 'Found post is not active');
  const ts = now();
  await d.db.run('UPDATE found_posts SET status = ?, updated_at = ? WHERE id = ?', status, ts, String(post.id));
  return c.json(success(foundPostRead({...post, status, updated_at: ts})));
}

posts.post('/found-posts/:postId/resolve', c => closeFoundPost(c, 'resolved'));
posts.post('/found-posts/:postId/cancel', c => closeFoundPost(c, 'cancelled'));

posts.post('/found-posts/:postId/contact', async c => {
  const user = await currentUser(c);
  const d = deps(c);
  const post = await visibleFoundPostOr404(d.db, c.req.param('postId'), user);
  if (!post.reporter_id) throw new AppError(404, 'REPORTER_NOT_FOUND', 'Reporter is not available');
  const conversation = await findOrCreateConversation(d, user, String(post.reporter_id), 'lost_found', String(post.id));
  return c.json(success(conversationRead(conversation)), 201);
});

posts.post('/found-posts/:postId/share-card', async c => {
  await currentUser(c);
  const d = deps(c);
  const post = await d.db.get<Row>('found_posts', c.req.param('postId'));
  if (!post) throw new AppError(404, 'FOUND_POST_NOT_FOUND', 'Found post not found');
  const kind = post.animal_type === 'dog' ? 'Dog' : post.animal_type === 'cat' ? 'Cat' : 'Pet';
  const url = await generateShareCard(d.env, {
    kind: 'found',
    title: `Found ${kind}`,
    subtitle: [post.breed_guess, post.color].filter(Boolean).join(' · ') || 'Awaiting owner',
    location: (post.location_text as string) || `${Number(post.latitude).toFixed(4)}, ${Number(post.longitude).toFixed(4)}`,
    dateText: formatDayMonYear(String(post.found_at)),
    keySuffix: `found-${post.id}`,
  });
  return c.json(success({url, share_url: `/found/${post.share_token}`}));
});

// ---------- Sightings ----------

posts.get('/lost-posts/:postId/sightings', async c => {
  const {db} = deps(c);
  const id = c.req.param('postId');
  await lostPostOr404(db, id);
  const rows = await db.all<Row>('SELECT * FROM sightings WHERE lost_post_id = ? ORDER BY seen_at DESC', id);
  return c.json(success(rows.map(sightingRead)));
});

posts.post('/lost-posts/:postId/sightings', async c => {
  const user = await currentUser(c);
  const body = await parseBody(c, SightingCreate);
  const d = deps(c);
  const post = await lostPostOr404(d.db, c.req.param('postId'));
  if (post.status !== 'active') throw new AppError(409, 'LOST_POST_ALREADY_RESOLVED', 'This lost case is closed');
  const images = [...new Set([...body.image_urls, body.image_url].filter((u): u is string => !!u))].slice(0, 3);
  const row: Row = {
    id: uuid(),
    lost_post_id: post.id,
    reporter_id: user.id,
    image_url: images[0] ?? null,
    image_urls: images.length ? JSON.stringify(images) : null,
    seen_at: body.seen_at,
    latitude: body.latitude,
    longitude: body.longitude,
    location_text: body.location_text ?? null,
    direction: body.direction ?? null,
    description: body.description ?? null,
    created_at: now(),
  };
  await d.db.insert('sightings', row as Record<string, string | number | null>);
  await notifySighting(d, post, user.id);
  return c.json(success(sightingRead(row)), 201);
});

// ---------- Feed ----------

const FeedQuery = z.object({
  kind: z.enum(['all', 'lost', 'found']).default('all'),
  animal_type: z.string().optional(),
  breed: z.string().optional(),
  color: z.string().optional(),
  cursor: z.string().optional(),
  limit: int().pipe(z.number().min(1).max(50)).default(20),
});

posts.get('/feed', async c => {
  const q = parseQuery(c, FeedQuery);
  const viewer = await optionalUser(c);
  const {db} = deps(c);
  // Breed/color matching tolerates free-typed legacy values, so it runs here rather than in SQL.
  type FeedRow = [at: string, id: string, kind: 'lost' | 'found', post: Row];
  const rows: FeedRow[] = [];
  if (q.kind !== 'found') {
    const params: string[] = [];
    let sql = `${LOST_WITH_PET} WHERE l.status = 'active'`;
    if (q.animal_type) {
      sql += ' AND p.animal_type = ?';
      params.push(q.animal_type);
    }
    if (viewer) {
      sql += ' AND l.owner_id != ?';
      params.push(viewer.id);
    }
    for (const post of await db.all<Row>(sql, ...params)) {
      const animalType = String(post.p_animal_type);
      if (
        matchesPetOption(animalType, 'breed', post.p_breed as string, q.breed) &&
        matchesPetOption(animalType, 'color', post.p_color as string, q.color)
      ) {
        rows.push([String(post.created_at), String(post.id), 'lost', post]);
      }
    }
  }
  if (q.kind !== 'lost') {
    const params: string[] = [];
    let sql = "SELECT * FROM found_posts WHERE status = 'active'";
    if (q.animal_type) {
      sql += ' AND animal_type = ?';
      params.push(q.animal_type);
    }
    if (viewer) {
      sql += ' AND (reporter_id IS NULL OR reporter_id != ?)';
      params.push(viewer.id);
    }
    for (const post of await db.all<Row>(sql, ...params)) {
      const animalType = String(post.animal_type);
      if (
        matchesPetOption(animalType, 'breed', post.breed_guess as string, q.breed) &&
        matchesPetOption(animalType, 'color', post.color as string, q.color)
      ) {
        rows.push([String(post.created_at), String(post.id), 'found', post]);
      }
    }
  }
  rows.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0) : a[0] < b[0] ? 1 : -1));
  const after = parseCursor(q.cursor);
  const remaining = rows.filter(r => isOlder(r[0], r[1], after));
  const page = remaining.slice(0, q.limit);
  const [lostCount, foundCount] = await Promise.all([
    db.count("SELECT COUNT(*) FROM lost_posts WHERE status = 'active'"),
    db.count("SELECT COUNT(*) FROM found_posts WHERE status = 'active'"),
  ]);
  const last = page[page.length - 1];
  return c.json(
    success({
      items: page.map(([, , kind, post]) => ({kind, post: kind === 'lost' ? lostPostListItem(post) : foundPostRead(post)})),
      next_cursor: remaining.length > q.limit ? makeCursor(last[0], last[1]) : null,
      counts: {lost: lostCount, found: foundCount},
    }),
  );
});

// ---------- Nearby ----------

const NearbyQuery = z.object({
  latitude: lat(),
  longitude: lng(),
  radius_km: num().pipe(z.number().gt(0).max(100)).default(5),
  animal_type: z.string().optional(),
  post_type: z.string().regex(/^(lost|found|sighting)$/).optional(),
  days: int().pipe(z.number().min(1).max(365)).optional(),
});

posts.get('/nearby', async c => {
  const q = parseQuery(c, NearbyQuery);
  const {db} = deps(c);
  const since = q.days ? addMs(now(), -q.days * DAY_MS) : null;
  const within = (row: Row) => haversineKm(q.latitude, q.longitude, Number(row.latitude), Number(row.longitude));
  const lost: Record<string, unknown>[] = [];
  const found: Record<string, unknown>[] = [];
  const sightings: Record<string, unknown>[] = [];

  if (!q.post_type || q.post_type === 'lost') {
    const params: string[] = [];
    let sql = `${LOST_WITH_PET} WHERE l.status = 'active'`;
    if (q.animal_type) {
      sql += ' AND p.animal_type = ?';
      params.push(q.animal_type);
    }
    if (since) {
      sql += ' AND l.created_at >= ?';
      params.push(since);
    }
    for (const post of await db.all<Row>(`${sql} ORDER BY l.created_at DESC LIMIT 500`, ...params)) {
      const distance = within(post);
      if (distance <= q.radius_km) {
        lost.push({...lostPostRead(post), distance_km: round2(distance), pet: petSummary(prefixed(post, 'p_'))});
      }
    }
  }

  if (!q.post_type || q.post_type === 'found') {
    const params: string[] = [];
    let sql = "SELECT * FROM found_posts WHERE status = 'active'";
    if (q.animal_type) {
      sql += ' AND animal_type = ?';
      params.push(q.animal_type);
    }
    if (since) {
      sql += ' AND created_at >= ?';
      params.push(since);
    }
    for (const post of await db.all<Row>(`${sql} ORDER BY created_at DESC LIMIT 500`, ...params)) {
      const distance = within(post);
      if (distance <= q.radius_km) found.push({...foundPostRead(post), distance_km: round2(distance)});
    }
  }

  if (!q.post_type || q.post_type === 'sighting') {
    const params: string[] = [];
    let sql = `SELECT s.*, p.name AS pet_name FROM sightings s
      JOIN lost_posts l ON l.id = s.lost_post_id LEFT JOIN pets p ON p.id = l.pet_id
      WHERE l.status = 'active'`;
    if (since) {
      sql += ' AND s.seen_at >= ?';
      params.push(since);
    }
    if (q.animal_type) {
      sql += ' AND p.animal_type = ?';
      params.push(q.animal_type);
    }
    for (const s of await db.all<Row>(`${sql} ORDER BY s.seen_at DESC LIMIT 500`, ...params)) {
      const distance = within(s);
      if (distance <= q.radius_km) {
        sightings.push({
          id: s.id,
          lost_post_id: s.lost_post_id,
          seen_at: s.seen_at,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          location_text: s.location_text ?? null,
          direction: s.direction ?? null,
          description: s.description ?? null,
          distance_km: round2(distance),
          pet_name: s.pet_name ?? null,
        });
      }
    }
  }

  const byDistance = (a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.distance_km) - Number(b.distance_km);
  lost.sort(byDistance);
  found.sort(byDistance);
  sightings.sort(byDistance);
  return c.json(success({lost, found, sightings}));
});

