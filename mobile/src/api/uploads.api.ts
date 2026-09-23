import {api} from './client';
import {ApiSuccess} from '../types/api';
import {API_BASE_URL} from '../config/env';

export type LocalImage = {
  uri: string;
  fileName?: string | null;
  type?: string | null;
  fileSize?: number | null;
};

export type UploadedImage = {
  url: string;
  filename: string;
  key?: string;
};

type PresignResponse = {
  upload_url: string;
  key: string;
  filename: string;
  content_type: string;
  url: string;
};

/** Turn API-relative media paths into absolute URLs for Image components. */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
    return url;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Prefer direct S3/MinIO upload via pre-signed URL; fall back to API multipart. */
export async function uploadImage(image: LocalImage): Promise<string> {
  const name = image.fileName || `photo-${Date.now()}.jpg`;
  const type = (image.type || 'image/jpeg').toLowerCase();
  const contentType = type.includes('png')
    ? 'image/png'
    : type.includes('webp')
      ? 'image/webp'
      : 'image/jpeg';

  try {
    const presign = await api.post<ApiSuccess<PresignResponse>>('/uploads/presign', {
      content_type: contentType,
      filename: name,
    });
    const {upload_url, url} = presign.data.data;
    const blobRes = await fetch(image.uri);
    const blob = await blobRes.blob();
    const put = await fetch(upload_url, {
      method: 'PUT',
      headers: {'Content-Type': contentType},
      body: blob,
    });
    if (!put.ok) {
      throw new Error(`S3 upload failed (${put.status})`);
    }
    return url;
  } catch {
    const form = new FormData();
    form.append('file', {
      uri: image.uri,
      name,
      type: contentType,
    } as unknown as Blob);
    const response = await api.post<ApiSuccess<UploadedImage>>('/uploads', form, {
      timeout: 60_000,
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers === 'object') {
            delete (headers as Record<string, unknown>)['Content-Type'];
          }
          return data;
        },
      ],
    });
    return response.data.data.url;
  }
}
