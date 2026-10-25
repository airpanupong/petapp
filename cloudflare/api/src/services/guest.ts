import type {Ctx, Deps} from '../app';
import {dbOf} from '../app';
import {AppError} from '../lib/errors';
import {createToken, decodeToken, hmacSha256Hex} from '../lib/security';
import {addMs, now} from '../lib/time';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const GUEST_TOKEN_SECONDS = 30 * 60;

/** IPv6 clients usually own a whole /64, so limits apply to the prefix rather than one address. */
function clientNetwork(ip: string): string {
  if (!ip.includes(':')) return ip;
  return ip.split(':').slice(0, 4).join(':') + '::/64';
}

export function clientIp(c: Ctx): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
}

/** Raw IPs are never stored; this keyed hash is only comparable within this deployment. */
export async function ipHash(c: Ctx): Promise<string> {
  return (await hmacSha256Hex(c.env.SECRET_KEY, `guest-ip:${clientNetwork(clientIp(c))}`)).slice(0, 32);
}

export async function verifyTurnstile(c: Ctx, token: string): Promise<boolean> {
  const body = new FormData();
  body.append('secret', c.env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  body.append('remoteip', clientIp(c));
  try {
    const res = await fetch(SITEVERIFY, {method: 'POST', body});
    const data = (await res.json()) as {success?: boolean; 'error-codes'?: string[]};
    if (!data.success) console.log(JSON.stringify({msg: 'turnstile rejected', errors: data['error-codes']}));
    return data.success === true;
  } catch (err) {
    console.error(JSON.stringify({msg: 'turnstile verify failed', error: String(err)}));
    return false;
  }
}

export function issueGuestToken(c: Ctx, hash: string) {
  return createToken(c.env.SECRET_KEY, hash, 'guest', GUEST_TOKEN_SECONDS);
}

export async function assertNotBlocked(c: Ctx, hash: string) {
  if (await dbOf(c).one('SELECT 1 FROM guest_blocks WHERE ip_hash = ?', hash)) {
    throw new AppError(403, 'GUEST_BLOCKED', 'Guest reporting is not available from this network');
  }
}

/** Returns the hashed network the guest pass was issued to. */
export async function requireGuest(c: Ctx): Promise<string> {
  const token = c.req.header('x-guest-token');
  if (!token) throw new AppError(401, 'GUEST_TOKEN_REQUIRED', 'Guest verification required');
  let hash: string;
  try {
    const payload = await decodeToken(c.env.SECRET_KEY, token);
    if (payload.type !== 'guest') throw new Error('type');
    hash = payload.sub;
  } catch {
    throw new AppError(401, 'GUEST_TOKEN_INVALID', 'Guest verification expired, please verify again');
  }
  await assertNotBlocked(c, hash);
  return hash;
}

const GUEST_POST_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

/** Guest sightings have nobody to close them, so they close themselves after two weeks. */
export async function expireGuestFoundPosts(deps: Deps, at = now()) {
  return deps.db.run(
    "UPDATE found_posts SET status = 'closed', updated_at = ? WHERE is_guest = 1 AND status = 'active' AND created_at < ?",
    at,
    addMs(at, -GUEST_POST_LIFETIME_MS),
  );
}

export async function rateLimit(limiter: RateLimit, key: string) {
  const {success} = await limiter.limit({key});
  if (!success) throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please wait a moment');
}
