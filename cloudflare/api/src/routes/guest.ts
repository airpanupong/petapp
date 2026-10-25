import {Hono} from 'hono';
import {z} from 'zod';
import {deps, type AppEnv} from '../app';
import {placeholders, uuid, type Row} from '../lib/db';
import {tokenUrlsafe} from '../lib/encoding';
import {AppError, success} from '../lib/errors';
import {haversineKm} from '../lib/geo';
import {foundPostRead} from '../lib/serialize';
import {addMs, now} from '../lib/time';
import {datetime, num, optStr, parseBody} from '../lib/validate';
import {assertNotBlocked, ipHash, issueGuestToken, rateLimit, requireGuest, verifyTurnstile} from '../services/guest';
import {publicUrl} from '../services/storage';
import {photoColumns} from './posts';
import {storeUploadedImage} from './uploads';

const HOUR_MS = 60 * 60 * 1000;
const DAILY_POSTS_PER_NETWORK = 5;
const DAILY_UPLOADS_PER_NETWORK = 20;
const HOURLY_POSTS_SITEWIDE = 30;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const DUPLICATE_RADIUS_KM = 0.2;
const LINK = /(https?:\/\/|www\.|line\.me|t\.me\/|bit\.ly|\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|xyz|info|shop|site|online|link|app|top|vip|club|bet)\b)/i;

const noLinks = (max: number) =>
  optStr(max).refine(v => !v || !LINK.test(v), {message: 'Links are not allowed'});

const GuestSession = z.object({token: z.string().min(1).max(4096)});
const GuestFoundPost = z.object({
  animal_type: z.enum(['dog', 'cat', 'other']),
  breed_guess: noLinks(100),
  color: noLinks(100),
  description: noLinks(500),
  image_urls: z.array(z.string().min(1).max(1000)).min(1).max(3),
  found_at: datetime(),
  latitude: num().pipe(z.number().min(-90).max(90)),
  longitude: num().pipe(z.number().min(-180).max(180)),
  location_text: noLinks(300),
});

export const guest = new Hono<AppEnv>().basePath('/guest');

guest.post('/session', async c => {
  const body = await parseBody(c, GuestSession);
  const hash = await ipHash(c);
  await rateLimit(c.env.GUEST_SESSION_LIMIT, hash);
  await assertNotBlocked(c, hash);
  if (!(await verifyTurnstile(c, body.token))) {
    throw new AppError(403, 'GUEST_VERIFICATION_FAILED', 'Verification failed, please try again');
  }
  const {token, expiresAt} = await issueGuestToken(c, hash);
  return c.json(success({guest_token: token, expires_at: expiresAt}), 201);
});

guest.post('/uploads', async c => {
  const hash = await requireGuest(c);
  await rateLimit(c.env.GUEST_UPLOAD_LIMIT, hash);
  const today = await deps(c).db.count(
    'SELECT COUNT(*) FROM image_moderation WHERE ip_hash = ? AND is_guest = 1 AND created_at > ?',
    hash,
    addMs(now(), -24 * HOUR_MS),
  );
  if (today >= DAILY_UPLOADS_PER_NETWORK) throw new AppError(429, 'GUEST_DAILY_LIMIT', 'Daily guest limit reached, please sign in to continue');
  const stored = await storeUploadedImage(c, {uploaderId: null, ipHash: hash, guest: true});
  return c.json(success(stored), 201);
});

guest.post('/found-posts', async c => {
  const hash = await requireGuest(c);
  await rateLimit(c.env.GUEST_POST_LIMIT, hash);
  const body = await parseBody(c, GuestFoundPost);
  const d = deps(c);
  const ts = now();

  const [mine, sitewide] = await Promise.all([
    d.db.all<Row>('SELECT latitude, longitude, created_at FROM found_posts WHERE reporter_ip_hash = ? AND created_at > ?', hash, addMs(ts, -24 * HOUR_MS)),
    d.db.count('SELECT COUNT(*) FROM found_posts WHERE is_guest = 1 AND created_at > ?', addMs(ts, -HOUR_MS)),
  ]);
  if (mine.length >= DAILY_POSTS_PER_NETWORK) throw new AppError(429, 'GUEST_DAILY_LIMIT', 'Daily guest limit reached, please sign in to continue');
  if (sitewide >= HOURLY_POSTS_SITEWIDE) throw new AppError(503, 'GUEST_REPORTING_PAUSED', 'Guest reporting is paused for a while, please sign in to continue');
  const recent = mine.filter(r => String(r.created_at) > addMs(ts, -DUPLICATE_WINDOW_MS));
  if (recent.some(r => haversineKm(Number(r.latitude), Number(r.longitude), body.latitude, body.longitude) <= DUPLICATE_RADIUS_KM)) {
    throw new AppError(409, 'GUEST_DUPLICATE', 'This spot was just reported');
  }

  // Only images this guest uploaded through the screened endpoint may appear in the post.
  const prefix = publicUrl(c.env, '');
  const urls = [...new Set(body.image_urls)];
  const names = urls.map(u => (u.startsWith(prefix) ? u.slice(prefix.length) : ''));
  const screened = names.every(Boolean)
    ? await d.db.count(
        `SELECT COUNT(DISTINCT filename) FROM image_moderation
         WHERE ip_hash = ? AND is_guest = 1 AND verdict != 'rejected' AND filename IN (${placeholders(names.length)})`,
        hash,
        ...names,
      )
    : 0;
  if (screened !== names.length) throw new AppError(422, 'GUEST_IMAGE_INVALID', 'Please upload the photos again');

  const post: Row = {
    id: uuid(),
    reporter_id: null,
    is_guest: 1,
    reporter_ip_hash: hash,
    share_token: tokenUrlsafe(24),
    animal_type: body.animal_type,
    breed_guess: body.breed_guess ?? null,
    color: body.color ?? null,
    description: body.description ?? null,
    found_at: body.found_at,
    latitude: body.latitude,
    longitude: body.longitude,
    location_text: body.location_text ?? null,
    ...photoColumns(urls),
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };
  await d.db.insert('found_posts', post as Record<string, string | number | null>);
  return c.json(success(foundPostRead(post)), 201);
});
