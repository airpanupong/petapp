import type {Context} from 'hono';
import {Db, type Row} from './lib/db';
import {AppError} from './lib/errors';
import {decodeToken, TokenExpiredError} from './lib/security';
import {bool} from './lib/serialize';

/** What services need from a request (or a cron run): bindings, the database and background-work lifetime. */
export type Deps = {
  env: Env;
  db: Db;
  waitUntil: (promise: Promise<unknown>) => void;
};

export type AppEnv = {Bindings: Env; Variables: {deps: Deps}};
export type Ctx = Context<AppEnv>;

export type User = Row & {id: string; email: string; display_name: string; role: string; password_hash: string};

export function makeDeps(env: Env, ctx: {waitUntil(promise: Promise<unknown>): void}): Deps {
  return {
    env,
    db: new Db(env.DB),
    waitUntil: promise =>
      ctx.waitUntil(
        promise.catch(err => console.error(JSON.stringify({msg: 'background task failed', error: String(err)}))),
      ),
  };
}

export const deps = (c: Ctx): Deps => c.get('deps');
export const dbOf = (c: Ctx): Db => c.get('deps').db;

function bearer(c: Ctx): string | null {
  const header = c.req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

async function loadActiveUser(db: Db, id: unknown): Promise<User | null> {
  if (typeof id !== 'string') return null;
  const user = await db.get<User>('users', id);
  return user && bool(user.is_active) ? user : null;
}

export async function currentUser(c: Ctx): Promise<User> {
  const token = bearer(c);
  if (!token) throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Authentication required');
  let payload;
  try {
    payload = await decodeToken(c.env.SECRET_KEY, token);
  } catch (err) {
    if (err instanceof TokenExpiredError) throw new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Access token expired');
    throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid access token');
  }
  if (payload.type !== 'access') throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid access token type');
  const user = await loadActiveUser(dbOf(c), payload.sub);
  if (!user) throw new AppError(401, 'AUTH_INVALID_TOKEN', 'User is unavailable');
  return user;
}

export async function optionalUser(c: Ctx): Promise<User | null> {
  const token = bearer(c);
  if (!token) return null;
  try {
    const payload = await decodeToken(c.env.SECRET_KEY, token);
    if (payload.type !== 'access') return null;
    return await loadActiveUser(dbOf(c), payload.sub);
  } catch {
    return null;
  }
}

export function externalEffects(env: Env): boolean {
  return env.EXTERNAL_EFFECTS === 'on';
}
