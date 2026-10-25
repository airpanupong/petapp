// Web Push with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291), on WebCrypto.
import {b64decode, b64url, concat, randomBytes, utf8} from '../lib/encoding';

export type PushSubscription = {endpoint: string; p256dh: string; auth: string};

let vapidKey: Promise<CryptoKey> | null = null;
let vapidKeySource = '';

function signingKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const source = `${publicKey}:${privateKey}`;
  if (!vapidKey || vapidKeySource !== source) {
    const pub = b64decode(publicKey);
    const jwk: JsonWebKey = {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.slice(1, 33)),
      y: b64url(pub.slice(33, 65)),
      d: b64url(b64decode(privateKey)),
      ext: true,
    };
    vapidKey = crypto.subtle.importKey('jwk', jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
    vapidKeySource = source;
  }
  return vapidKey;
}

async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = b64url(utf8(JSON.stringify({typ: 'JWT', alg: 'ES256'})));
  const claims = b64url(utf8(JSON.stringify({aud, exp, sub: subject})));
  const input = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    {name: 'ECDSA', hash: 'SHA-256'},
    await signingKey(publicKey, privateKey),
    utf8(input),
  );
  return `vapid t=${input}.${b64url(new Uint8Array(sig))}, k=${publicKey}`;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt, info}, key, length * 8));
}

async function encrypt(sub: PushSubscription, payload: string): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64decode(sub.p256dh);
  const authSecret = b64decode(sub.auth);
  const local = (await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, {name: 'ECDH', namedCurve: 'P-256'}, false, []);
  // The runtime reads the standard `public` member; workers-types spells it `$public`.
  const ecdh = {name: 'ECDH', public: uaKey, $public: uaKey};
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = randomBytes(16);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plaintext = concat(utf8(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv: nonce}, aesKey, plaintext));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

/** Sends one push; returns the push service status code. */
export async function sendWebPush(
  sub: PushSubscription,
  payload: string,
  vapid: {publicKey: string; privateKey: string; subject: string},
  ttlSeconds = 24 * 60 * 60,
): Promise<number> {
  const body = await encrypt(sub, payload);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSeconds),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status >= 300) {
    const text = await res.text().catch(() => '');
    console.warn(JSON.stringify({msg: 'web push rejected', status: res.status, endpoint: sub.endpoint.slice(0, 40), body: text.slice(0, 200)}));
  } else {
    await res.body?.cancel();
  }
  return res.status;
}
