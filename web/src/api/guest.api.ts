import {api} from './client';
import {ApiSuccess, FoundPost} from '../types/api';

export async function createGuestSession(turnstileToken: string) {
  const r = await api.post<ApiSuccess<{guest_token: string; expires_at: string}>>('/guest/session', {token: turnstileToken});
  return r.data.data;
}

export async function guestUploadImage(file: File, guestToken: string) {
  const form = new FormData();
  form.append('file', file, file.name || `photo-${Date.now()}.jpg`);
  const r = await api.post<ApiSuccess<{url: string}>>('/guest/uploads', form, {
    timeout: 60_000,
    headers: {'Content-Type': 'multipart/form-data', 'X-Guest-Token': guestToken},
  });
  return r.data.data.url;
}

export async function createGuestFoundPost(
  payload: {
    animal_type: string;
    breed_guess?: string;
    color?: string;
    description?: string;
    image_urls: string[];
    found_at: string;
    latitude: number;
    longitude: number;
    location_text?: string;
  },
  guestToken: string,
) {
  const r = await api.post<ApiSuccess<FoundPost>>('/guest/found-posts', payload, {headers: {'X-Guest-Token': guestToken}});
  return r.data.data;
}
