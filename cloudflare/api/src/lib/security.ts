import {argon2id} from '@noble/hashes/argon2.js';
import {b64decode, b64encode, b64url, hex, randomBytes, timingSafeEqual, utf8} from './encoding';
import {uuid} from './db';

export const ACCESS_TOKEN_MINUTES = 30;
export const REFRESH_TOKEN_DAYS = 30;

// ---------- JWT (HS256, compatible with PyJWT tokens issued by the Python API) ----------

export type TokenType = 'access' | 'refresh' | 'guest';
export type TokenPayload = {sub: string; type: TokenType; jti: string; iat: number; exp: number};

export class TokenExpiredError extends Error {}
export class TokenInvalidError extends Error {}

const hmacKeys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', utf8(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
    hmacKeys.set(secret, key);
  }
  return key;
}

function b64json(value: unknown): string {
  return b64url(utf8(JSON.stringify(value)));
}

export async function createToken(secret: string, subject: string, type: TokenType, ttlSeconds: number) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const jti = uuid();
  const signingInput = `${b64json({alg: 'HS256', typ: 'JWT'})}.${b64json({sub: subject, type, jti, iat, exp})}`;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), utf8(signingInput)));
  return {token: `${signingInput}.${b64url(sig)}`, jti, expiresAt: new Date(exp * 1000).toISOString()};
}

export async function decodeToken(secret: string, token: string): Promise<TokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenInvalidError('malformed');
  let header: {alg?: string};
  let payload: Record<string, unknown>;
  let sig: Uint8Array<ArrayBuffer>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64decode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64decode(parts[1])));
    sig = b64decode(parts[2]);
  } catch {
    throw new TokenInvalidError('malformed');
  }
  if (header.alg !== 'HS256' || typeof payload !== 'object' || payload === null) throw new TokenInvalidError('alg');
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, utf8(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new TokenInvalidError('signature');
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number') throw new TokenInvalidError('exp');
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new TokenExpiredError('expired');
  }
  return payload as unknown as TokenPayload;
}

export function createAccessToken(secret: string, userId: string) {
  return createToken(secret, userId, 'access', ACCESS_TOKEN_MINUTES * 60);
}

export function createRefreshToken(secret: string, userId: string) {
  return createToken(secret, userId, 'refresh', REFRESH_TOKEN_DAYS * 24 * 60 * 60);
}

export async function sha256Hex(text: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(text))));
}

export async function hmacSha256Hex(secret: string, text: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), utf8(text))));
}

// ---------- Passwords ----------
// Accounts created on the Python API carry argon2-cffi hashes; verifying them in pure JS costs ~0.6 s CPU,
// so a successful login rehashes to PBKDF2-SHA256 (Workers caps PBKDF2 at 100k iterations).

const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, length: number) {
  const key = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, key, length * 8);
  return new Uint8Array(bits);
}

const unpad = (s: string) => s.replace(/=+$/, '');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await pbkdf2(password, salt, PBKDF2_ITERATIONS, 32);
  return `$pbkdf2-sha256$i=${PBKDF2_ITERATIONS}$${unpad(b64encode(salt))}$${unpad(b64encode(digest))}`;
}

export function needsRehash(hash: string): boolean {
  return !hash.startsWith(`$pbkdf2-sha256$i=${PBKDF2_ITERATIONS}$`);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split('$');
    if (parts[1] === 'pbkdf2-sha256') {
      const iterations = Number(parts[2].replace('i=', ''));
      const expected = b64decode(parts[4]);
      const actual = await pbkdf2(password, b64decode(parts[3]), iterations, expected.length);
      return timingSafeEqual(actual, expected);
    }
    if (parts[1] === 'argon2id' && parts[2] === 'v=19') {
      const params = Object.fromEntries(parts[3].split(',').map(kv => kv.split('='))) as Record<string, string>;
      const expected = b64decode(parts[5]);
      const actual = argon2id(utf8(password), b64decode(parts[4]), {
        t: Number(params.t),
        m: Number(params.m),
        p: Number(params.p),
        dkLen: expected.length,
      });
      return timingSafeEqual(actual, expected);
    }
  } catch {
    return false;
  }
  return false;
}

// ---------- Identifiers ----------

export function generatePetCode(): string {
  return `PET-${hex(randomBytes(3)).toUpperCase()}`;
}

export function generateQrToken(): string {
  return b64url(randomBytes(32));
}

export function randomBelow(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}
