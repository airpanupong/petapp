// Uploads live in R2 under "uploads/<filename>" and are served by GET /api/v1/uploads/files/<filename>,
// the same URLs the Python API produced from its disk volume.

const FILES_PATH = '/api/v1/uploads/files/';

export function mediaTypeFor(filename: string): string {
  const name = filename.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export function publicUrl(env: Env, filename: string): string {
  const base = (env.PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return `${base}${FILES_PATH}${filename}`;
}

const safeName = (name: string) => name.split('/').pop() ?? '';

export async function uploadBytes(env: Env, filename: string, data: ArrayBuffer | Uint8Array, contentType: string) {
  await env.UPLOADS.put(`uploads/${safeName(filename)}`, data, {
    httpMetadata: {contentType, cacheControl: 'public, max-age=31536000, immutable'},
  });
  return publicUrl(env, safeName(filename));
}

export function getFile(env: Env, filename: string) {
  const name = safeName(filename);
  return name ? env.UPLOADS.get(`uploads/${name}`) : Promise.resolve(null);
}

/** Best-effort removal of a file this API produced; foreign URLs are ignored. */
export async function deleteUrl(env: Env, url: string | null | undefined): Promise<void> {
  if (!url || !url.includes('/uploads/files/')) return;
  const name = safeName(url.split('/uploads/files/')[1] ?? '');
  if (!name) return;
  try {
    await env.UPLOADS.delete(`uploads/${name}`);
  } catch (err) {
    console.warn(JSON.stringify({msg: 'could not delete upload', url, error: String(err)}));
  }
}
