import {api} from './client';
import {ApiSuccess} from '../types/api';
import {API_ORIGIN} from '../lib/config';

type PresignResponse = {
  upload_url: string;
  key: string;
  filename: string;
  content_type: string;
  url: string;
};

/** Turn API-relative media paths into absolute URLs. */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

function normalizeType(type: string) {
  const t = type.toLowerCase();
  if (t.includes('png')) return 'image/png';
  if (t.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Prefer direct S3 upload via pre-signed URL; fall back to API multipart. */
export async function uploadImage(file: File): Promise<string> {
  const contentType = normalizeType(file.type || 'image/jpeg');
  const filename = file.name || `photo-${Date.now()}.jpg`;
  try {
    const presign = await api.post<ApiSuccess<PresignResponse>>('/uploads/presign', {
      content_type: contentType,
      filename,
    });
    const {upload_url, url} = presign.data.data;
    const put = await fetch(upload_url, {method: 'PUT', headers: {'Content-Type': contentType}, body: file});
    if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
    return url;
  } catch {
    const form = new FormData();
    form.append('file', file, filename);
    const response = await api.post<ApiSuccess<{url: string}>>('/uploads', form, {
      timeout: 60_000,
      headers: {'Content-Type': 'multipart/form-data'},
    });
    return response.data.data.url;
  }
}
