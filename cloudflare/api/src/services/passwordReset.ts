import type {Deps, User} from '../app';
import {uuid} from '../lib/db';
import {AppError} from '../lib/errors';
import {hashPassword, hmacSha256Hex, randomBelow} from '../lib/security';
import {bool} from '../lib/serialize';
import {addMs, now} from '../lib/time';
import {timingSafeEqual, utf8} from '../lib/encoding';
import {sendEmail} from './email';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const digest = (env: Env, userId: string, code: string) => hmacSha256Hex(env.SECRET_KEY, `${userId}:${code}`);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

async function userByEmail(deps: Deps, email: string): Promise<User> {
  const user = await deps.db.one<User>('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());
  if (!user) throw new AppError(404, 'EMAIL_NOT_FOUND', 'Email is not registered');
  if (!bool(user.is_active)) throw new AppError(403, 'AUTH_FORBIDDEN', 'Account is disabled');
  return user;
}

function resetEmail(user: User, code: string): [string, string, string] {
  const minutes = CODE_TTL_MS / 60000;
  const subject = `รหัสยืนยันรีเซ็ตรหัสผ่าน Pet haii: ${code}`;
  const text =
    `สวัสดี ${user.display_name}\n\n` +
    `รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของคุณคือ ${code}\n` +
    `รหัสนี้ใช้ได้ ${minutes} นาที\n\n` +
    'ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย\n\n' +
    'Pet haii · พาน้องกลับบ้าน\nhttps://pethaii.com';
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#4b3a36">
  <h2 style="color:#e0566f;margin:0 0 12px">Pet haii</h2>
  <p>สวัสดี ${escapeHtml(user.display_name)}</p>
  <p>รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของคุณคือ</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#fff4ec;border-radius:12px;padding:16px;text-align:center">${code}</p>
  <p>รหัสนี้ใช้ได้ ${minutes} นาที</p>
  <p style="color:#9a8580;font-size:13px">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย</p>
  <p style="color:#9a8580;font-size:13px">Pet haii · พาน้องกลับบ้าน · <a href="https://pethaii.com">pethaii.com</a></p>
</div>`;
  return [subject, text, html];
}

export async function requestResetCode(deps: Deps, email: string) {
  const user = await userByEmail(deps, email);
  const ts = now();
  const recent = (
    await deps.db.all<{created_at: string}>(
      'SELECT created_at FROM password_reset_codes WHERE user_id = ? AND created_at >= ?',
      user.id,
      addMs(ts, -60 * 60 * 1000),
    )
  ).map(r => r.created_at);
  if (recent.length) {
    const latest = recent.reduce((a, b) => (a > b ? a : b));
    const waitMs = RESEND_COOLDOWN_MS - (Date.parse(ts) - Date.parse(latest));
    if (waitMs > 0) {
      throw new AppError(429, 'RESET_COOLDOWN', 'Please wait before requesting a new code', {
        retry_after: Math.floor(waitMs / 1000) + 1,
      });
    }
  }
  if (recent.length >= MAX_CODES_PER_HOUR) throw new AppError(429, 'RESET_TOO_MANY', 'Too many code requests. Try again later');

  const code = String(randomBelow(1_000_000)).padStart(6, '0');
  // Send first so a failed email leaves earlier codes usable, like the Python rollback.
  await sendEmail(deps.env, String(user.email), ...resetEmail(user, code));
  await deps.db.batch([
    deps.db.stmt('UPDATE password_reset_codes SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL', ts, user.id),
    deps.db.insertStmt('password_reset_codes', {
      id: uuid(),
      user_id: user.id,
      code_hash: await digest(deps.env, user.id, code),
      attempts: 0,
      expires_at: addMs(ts, CODE_TTL_MS),
      created_at: ts,
    }),
  ]);
  return {sent: true, expires_in: CODE_TTL_MS / 1000, resend_in: RESEND_COOLDOWN_MS / 1000};
}

async function checkCode(deps: Deps, user: User, code: string) {
  const row = await deps.db.one<{id: string; code_hash: string; attempts: number; expires_at: string}>(
    'SELECT * FROM password_reset_codes WHERE user_id = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1',
    user.id,
  );
  if (!row || row.expires_at <= now()) throw new AppError(400, 'RESET_CODE_EXPIRED', 'Code expired. Request a new one');
  if (row.attempts >= MAX_ATTEMPTS) throw new AppError(400, 'RESET_CODE_LOCKED', 'Too many attempts. Request a new code');
  const expected = await digest(deps.env, user.id, code.trim());
  if (!timingSafeEqual(utf8(row.code_hash), utf8(expected))) {
    const attempts = row.attempts + 1;
    await deps.db.run('UPDATE password_reset_codes SET attempts = ? WHERE id = ?', attempts, row.id);
    if (attempts >= MAX_ATTEMPTS) throw new AppError(400, 'RESET_CODE_LOCKED', 'Too many attempts. Request a new code');
    throw new AppError(400, 'RESET_CODE_INVALID', 'Invalid code');
  }
  return row;
}

export async function verifyResetCode(deps: Deps, email: string, code: string) {
  await checkCode(deps, await userByEmail(deps, email), code);
}

export async function resetPassword(deps: Deps, email: string, code: string, newPassword: string): Promise<User> {
  const user = await userByEmail(deps, email);
  const row = await checkCode(deps, user, code);
  const ts = now();
  const hash = await hashPassword(newPassword);
  await deps.db.batch([
    deps.db.stmt('UPDATE password_reset_codes SET consumed_at = ? WHERE id = ?', ts, row.id),
    deps.db.stmt('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hash, ts, user.id),
    deps.db.stmt('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', ts, user.id),
  ]);
  user.password_hash = hash;
  return user;
}
