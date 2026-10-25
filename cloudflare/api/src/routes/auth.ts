import {Hono} from 'hono';
import {z} from 'zod';
import {deps, type AppEnv, type User} from '../app';
import {uuid} from '../lib/db';
import {AppError, success} from '../lib/errors';
import {hashPassword} from '../lib/security';
import {bool, userRead} from '../lib/serialize';
import {now} from '../lib/time';
import {bool as boolField, email, parseBody, str} from '../lib/validate';
import {checkPassword, issueTokenPair, revokeRefreshToken, rotateRefreshToken} from '../services/auth';
import {requestResetCode, resetPassword, verifyResetCode} from '../services/passwordReset';

// Bump when the privacy policy or data-access terms change (matches web/src/pages/PrivacyPage.tsx).
const CONSENT_VERSION = '2026-09-30';

const RegisterRequest = z.object({
  email: email(),
  password: str(128, 8),
  display_name: str(120, 1),
  accept_privacy: boolField().default(false),
  accept_data_access: boolField().default(false),
});
const LoginRequest = z.object({email: email(), password: z.string()});
const TokenRequest = z.object({refresh_token: z.string()});
const ForgotRequest = z.object({email: email()});
const VerifyRequest = z.object({email: email(), code: z.string().regex(/^\s*\d{6}\s*$/)});
const ResetRequest = VerifyRequest.extend({new_password: str(128, 8)});

export const auth = new Hono<AppEnv>().basePath('/auth');

const sessionPayload = async (c: Parameters<typeof deps>[0], user: User) => ({
  user: userRead(user),
  ...(await issueTokenPair(deps(c), user)),
});

auth.post('/register', async c => {
  const body = await parseBody(c, RegisterRequest);
  if (!(body.accept_privacy && body.accept_data_access)) {
    throw new AppError(400, 'CONSENT_REQUIRED', 'กรุณายอมรับนโยบายความเป็นส่วนตัวและการเข้าถึงข้อมูลก่อนสมัคร');
  }
  const {db} = deps(c);
  const emailAddr = body.email.toLowerCase().trim();
  if (await db.one('SELECT id FROM users WHERE email = ?', emailAddr)) {
    throw new AppError(409, 'USER_EMAIL_EXISTS', 'Email is already registered');
  }
  const ts = now();
  const user = {
    id: uuid(),
    email: emailAddr,
    password_hash: await hashPassword(body.password),
    display_name: body.display_name.trim(),
    phone: null,
    avatar_url: null,
    status: 'active',
    role: 'user',
    is_active: 1,
    created_at: ts,
    updated_at: ts,
    privacy_accepted_at: ts,
    data_access_accepted_at: ts,
    consent_version: CONSENT_VERSION,
  };
  try {
    await db.insert('users', user);
  } catch (err) {
    if (String(err).includes('UNIQUE')) throw new AppError(409, 'USER_EMAIL_EXISTS', 'Email is already registered');
    throw err;
  }
  return c.json(success(await sessionPayload(c, user as unknown as User)), 201);
});

auth.post('/login', async c => {
  const body = await parseBody(c, LoginRequest);
  const d = deps(c);
  const user = await d.db.one<User>('SELECT * FROM users WHERE email = ?', body.email.toLowerCase().trim());
  if (!user || !(await checkPassword(d, user, body.password))) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!bool(user.is_active)) throw new AppError(403, 'AUTH_FORBIDDEN', 'Account is disabled');
  await d.db.run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
  return c.json(success(await sessionPayload(c, user)));
});

auth.post('/refresh', async c => {
  const body = await parseBody(c, TokenRequest);
  const {user, tokens} = await rotateRefreshToken(deps(c), body.refresh_token);
  return c.json(success({user: userRead(user), ...tokens}));
});

auth.post('/logout', async c => {
  const body = await parseBody(c, TokenRequest);
  await revokeRefreshToken(deps(c), body.refresh_token);
  return c.json(success(null, 'Logged out'));
});

auth.post('/password/forgot', async c => {
  const body = await parseBody(c, ForgotRequest);
  return c.json(success(await requestResetCode(deps(c), body.email)));
});

auth.post('/password/verify', async c => {
  const body = await parseBody(c, VerifyRequest);
  await verifyResetCode(deps(c), body.email, body.code);
  return c.json(success({valid: true}));
});

auth.post('/password/reset', async c => {
  const body = await parseBody(c, ResetRequest);
  const d = deps(c);
  const user = await resetPassword(d, body.email, body.code, body.new_password);
  await d.db.run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
  return c.json(success(await sessionPayload(c, user)));
});
