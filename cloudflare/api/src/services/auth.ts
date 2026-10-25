import type {Deps, User} from '../app';
import {uuid} from '../lib/db';
import {AppError} from '../lib/errors';
import {
  createAccessToken,
  createRefreshToken,
  decodeToken,
  hashPassword,
  needsRehash,
  sha256Hex,
  TokenExpiredError,
  verifyPassword,
} from '../lib/security';
import {bool} from '../lib/serialize';
import {now} from '../lib/time';

export async function issueTokenPair(deps: Deps, user: User) {
  const secret = deps.env.SECRET_KEY;
  const access = await createAccessToken(secret, user.id);
  const refresh = await createRefreshToken(secret, user.id);
  await deps.db.insert('refresh_tokens', {
    id: uuid(),
    user_id: user.id,
    jti: refresh.jti,
    token_hash: await sha256Hex(refresh.token),
    expires_at: refresh.expiresAt,
    created_at: now(),
  });
  return {access_token: access.token, refresh_token: refresh.token, token_type: 'bearer'};
}

export async function rotateRefreshToken(deps: Deps, rawToken: string) {
  let payload;
  try {
    payload = await decodeToken(deps.env.SECRET_KEY, rawToken);
  } catch (err) {
    if (err instanceof TokenExpiredError) throw new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Refresh token expired');
    throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid refresh token');
  }
  if (payload.type !== 'refresh') throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid refresh token type');

  const row = await deps.db.one<{id: string; revoked_at: string | null; expires_at: string}>(
    'SELECT id, revoked_at, expires_at FROM refresh_tokens WHERE jti = ? AND token_hash = ?',
    payload.jti,
    await sha256Hex(rawToken),
  );
  if (!row || row.revoked_at != null) throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Refresh token has been revoked');
  if (row.expires_at <= now()) throw new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Refresh token expired');

  const user = await deps.db.get<User>('users', payload.sub);
  if (!user || !bool(user.is_active)) throw new AppError(401, 'AUTH_INVALID_TOKEN', 'User is unavailable');

  // Only one concurrent refresh with the same token may win.
  const revoked = await deps.db.run(
    'UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
    now(),
    row.id,
  );
  if (!revoked) throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Refresh token has been revoked');
  return {user, tokens: await issueTokenPair(deps, user)};
}

export async function revokeRefreshToken(deps: Deps, rawToken: string) {
  let payload;
  try {
    payload = await decodeToken(deps.env.SECRET_KEY, rawToken);
  } catch {
    return;
  }
  await deps.db.run(
    'UPDATE refresh_tokens SET revoked_at = ? WHERE jti = ? AND token_hash = ? AND revoked_at IS NULL',
    now(),
    payload.jti,
    await sha256Hex(rawToken),
  );
}

/** Verifies the password and upgrades legacy Argon2 hashes to the Workers-native format. */
export async function checkPassword(deps: Deps, user: User, password: string): Promise<boolean> {
  if (!(await verifyPassword(password, user.password_hash))) return false;
  if (needsRehash(user.password_hash)) {
    const upgraded = await hashPassword(password);
    await deps.db.run('UPDATE users SET password_hash = ? WHERE id = ?', upgraded, user.id);
    user.password_hash = upgraded;
  }
  return true;
}
