import {Hono} from 'hono';
import {z} from 'zod';
import {currentUser, dbOf, type AppEnv, type Ctx} from '../app';
import {AppError, success} from '../lib/errors';
import {parseBody, validationError} from '../lib/validate';
import {classifyImage, logModeration, rejectionError} from '../services/moderation';
import {getFile, mediaTypeFor, publicUrl, uploadBytes} from '../services/storage';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 1600;

const PresignRequest = z.object({
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']).default('image/jpeg'),
  filename: z.string().max(200).nullish(),
});

function resolveExt(contentType: string, filename: string | null | undefined): [string, string] {
  const ext = ALLOWED_TYPES[contentType];
  if (ext) return [ext, ext === '.jpg' ? 'image/jpeg' : contentType];
  const name = (filename ?? '').toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return ['.jpg', 'image/jpeg'];
  if (name.endsWith('.png')) return ['.png', 'image/png'];
  if (name.endsWith('.webp')) return ['.webp', 'image/webp'];
  throw new AppError(400, 'UPLOAD_INVALID_TYPE', 'Only JPEG, PNG or WebP images are allowed');
}

const streamOf = (data: ArrayBuffer) => new Response(data).body!;

/** Rotate per EXIF, cap the long side and re-encode; keep the original if the image cannot be read. */
async function optimize(env: Env, data: ArrayBuffer, ext: string, media: string): Promise<[ArrayBuffer, string, string]> {
  try {
    const info = await env.IMAGES.info(streamOf(data));
    if (!('width' in info)) return [data, ext, media];
    const resized = Math.max(info.width, info.height) > MAX_SIDE;
    // Transparent formats stay WebP so the alpha channel survives; everything else becomes JPEG.
    const keepAlpha = info.format === 'image/png' || info.format === 'image/webp' || info.format === 'image/gif';
    const format = keepAlpha ? 'image/webp' : 'image/jpeg';
    const result = await env.IMAGES.input(streamOf(data))
      .transform({width: MAX_SIDE, height: MAX_SIDE, fit: 'scale-down'})
      .output({format, quality: 85});
    const out = await result.response().arrayBuffer();
    const keepOriginal = !resized && data.byteLength <= out.byteLength && ext !== '.heic';
    return keepOriginal ? [data, ext, media] : [out, keepAlpha ? '.webp' : '.jpg', format];
  } catch (err) {
    console.log(JSON.stringify({msg: 'image optimize skipped', error: String(err)}));
    return [data, ext, media];
  }
}

export const uploads = new Hono<AppEnv>().basePath('/uploads');

uploads.post('/presign', async c => {
  await currentUser(c);
  const body = await parseBody(c, PresignRequest);
  resolveExt(body.content_type, body.filename);
  // Same as the Python API on local storage: clients fall back to POST /uploads.
  throw new AppError(501, 'PRESIGN_UNAVAILABLE', 'Direct upload is unavailable; use POST /uploads');
});

/** Reads the multipart "file", screens it, and stores it in R2. Rejected images are logged but never stored. */
export async function storeUploadedImage(c: Ctx, who: {uploaderId: string | null; ipHash: string | null; guest: boolean}) {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw validationError([{type: 'missing', loc: ['body', 'file'], msg: 'Field required'}]);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    throw validationError([{type: 'missing', loc: ['body', 'file'], msg: 'Field required'}]);
  }
  let [ext, media] = resolveExt((file.type || '').toLowerCase(), file.name);
  let data = await file.arrayBuffer();
  if (!data.byteLength) throw new AppError(400, 'UPLOAD_EMPTY', 'Empty file');
  if (data.byteLength > MAX_BYTES) throw new AppError(400, 'UPLOAD_TOO_LARGE', 'Image must be 8MB or smaller');
  [data, ext, media] = await optimize(c.env, data, ext, media);
  const verdict = await classifyImage(c.env, data, who.guest);
  const filename = verdict.verdict === 'rejected' ? null : `${crypto.randomUUID().replace(/-/g, '')}${ext}`;
  await logModeration(dbOf(c), verdict, {filename, ...who});
  if (!filename) throw rejectionError(verdict);
  const url = await uploadBytes(c.env, filename, data, media);
  return {url, key: `uploads/${filename}`, filename};
}

uploads.post('/', async c => {
  const user = await currentUser(c);
  const stored = await storeUploadedImage(c, {uploaderId: user.id, ipHash: null, guest: false});
  return c.json(success({...stored, uploader_id: user.id}), 201);
});

uploads.get('/files/:filename', async c => {
  const cache = caches.default;
  const cacheKey = new Request(publicUrl(c.env, c.req.param('filename')));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const object = await getFile(c.env, c.req.param('filename'));
  if (!object) throw new AppError(404, 'UPLOAD_NOT_FOUND', 'File not found');
  const res = new Response(object.body, {
    headers: {
      'Content-Type': mediaTypeFor(c.req.param('filename')),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: object.httpEtag,
      'Content-Length': String(object.size),
    },
  });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});
