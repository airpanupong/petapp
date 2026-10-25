import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {externalEffects, makeDeps, type AppEnv} from './app';
import {AppError, errorPayload, errorResponse} from './lib/errors';
import {uuid} from './lib/db';
import {SUPER_ADMIN} from './lib/roles';
import {hashPassword} from './lib/security';
import {admin} from './routes/admin';
import {auth} from './routes/auth';
import {chat} from './routes/chat';
import {geo} from './routes/geo';
import {guest} from './routes/guest';
import {misc} from './routes/misc';
import {notifications} from './routes/notifications';
import {pets} from './routes/pets';
import {posts} from './routes/posts';
import {uploads} from './routes/uploads';
import {users} from './routes/users';
import {expireGuestFoundPosts} from './services/guest';
import {runLostCheckins} from './services/lostCheckin';

export {InboxDO} from './do/inbox';
export {GeoDO} from './do/geo';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  c.set('deps', makeDeps(c.env, c.executionCtx));
  await next();
});

app.use('*', async (c, next) => {
  const origins = (c.env.CORS_ORIGINS || '*').split(',').map(o => o.trim()).filter(Boolean);
  const wildcard = origins.includes('*');
  return cors({
    origin: wildcard ? '*' : origins,
    credentials: !wildcard,
    allowMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    maxAge: 600,
  })(c, next);
});

app.get('/health', c => c.json({status: 'ok'}));

const api = new Hono<AppEnv>();
api.route('/', auth);
api.route('/', users);
api.route('/', pets);
api.route('/', posts);
api.route('/', geo);
api.route('/', notifications);
api.route('/', misc);
api.route('/', chat);
api.route('/', uploads);
api.route('/', guest);
api.route('/', admin);

app.route('/api/v1', api);

app.notFound(c => c.json({detail: 'Not Found'}, 404));

app.onError((err, c) => {
  if (err instanceof AppError) return errorResponse(err);
  console.error(JSON.stringify({msg: 'unhandled error', path: c.req.path, error: String(err), stack: (err as Error).stack}));
  return c.json(errorPayload('INTERNAL_ERROR', 'Internal server error'), 500);
});

/** Ensure the configured super admin keeps its role (the Python API did this on every deploy). */
async function ensureSuperAdmin(env: Env) {
  const email = (env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email) return;
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!existing) {
    if (!env.SUPER_ADMIN_PASSWORD) return;
    await env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, display_name, status, role, is_active) VALUES (?, ?, ?, 'Pet haii Support', 'active', ?, 1)",
    )
      .bind(uuid(), email, await hashPassword(env.SUPER_ADMIN_PASSWORD), SUPER_ADMIN)
      .run();
    console.log(JSON.stringify({msg: 'created super admin', email}));
    return;
  }
  await env.DB.prepare(
    "UPDATE users SET role = ?, is_active = 1, status = 'active' WHERE email = ? AND (role != ? OR is_active = 0)",
  )
    .bind(SUPER_ADMIN, email, SUPER_ADMIN)
    .run();
}

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    if (!externalEffects(env)) return;
    const deps = makeDeps(env, ctx);
    await ensureSuperAdmin(env);
    await runLostCheckins(deps);
    await expireGuestFoundPosts(deps);
  },
} satisfies ExportedHandler<Env>;
