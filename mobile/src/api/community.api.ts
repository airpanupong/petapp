import {api} from './client';
import {Ad, ApiSuccess, FoundPost, LostPost, NearbyResult, Sighting} from '../types/api';

export async function listLostPosts() {
  const response = await api.get<ApiSuccess<LostPost[]>>('/lost-posts');
  return response.data.data;
}

export async function createLostPost(payload: {
  pet_id: string;
  lost_at: string;
  latitude: number;
  longitude: number;
  location_text?: string;
  search_radius_km: number;
  description?: string;
  reward_enabled?: boolean;
  reward_text?: string;
  image_url?: string;
}) {
  const response = await api.post<ApiSuccess<LostPost>>('/lost-posts', payload);
  return response.data.data;
}

export async function resolveLostPost(id: string) {
  const response = await api.post<ApiSuccess<LostPost>>(`/lost-posts/${id}/resolve`);
  return response.data.data;
}

export async function cancelLostPost(id: string) {
  const response = await api.post<ApiSuccess<LostPost>>(`/lost-posts/${id}/cancel`);
  return response.data.data;
}

export async function createLostShareCard(id: string) {
  const response = await api.post<ApiSuccess<{url: string; share_url: string}>>(`/lost-posts/${id}/share-card`);
  return response.data.data;
}

export async function createFoundShareCard(id: string) {
  const response = await api.post<ApiSuccess<{url: string; share_url: string}>>(`/found-posts/${id}/share-card`);
  return response.data.data;
}

export async function resolveFoundPost(id: string) {
  const response = await api.post<ApiSuccess<FoundPost>>(`/found-posts/${id}/resolve`);
  return response.data.data;
}

export async function listFoundPosts() {
  const response = await api.get<ApiSuccess<FoundPost[]>>('/found-posts');
  return response.data.data;
}

export async function createFoundPost(payload: {
  animal_type: 'dog' | 'cat' | 'other';
  breed_guess?: string;
  color?: string;
  description?: string;
  image_url?: string;
  found_at: string;
  latitude: number;
  longitude: number;
  location_text?: string;
}) {
  const response = await api.post<ApiSuccess<FoundPost>>('/found-posts', payload);
  return response.data.data;
}

export async function createSighting(lostPostId: string, payload: {
  seen_at: string;
  latitude: number;
  longitude: number;
  location_text?: string;
  direction?: string;
  description?: string;
}) {
  const response = await api.post<ApiSuccess<Sighting>>(
    `/lost-posts/${lostPostId}/sightings`,
    payload,
  );
  return response.data.data;
}

export async function getNearby(params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  animal_type?: string;
  post_type?: 'lost' | 'found' | 'sighting';
  days?: number;
}) {
  const response = await api.get<ApiSuccess<NearbyResult>>('/nearby', {params});
  return response.data.data;
}

export async function getLostPost(id: string) {
  const response = await api.get<ApiSuccess<LostPost>>(`/lost-posts/${id}`);
  return response.data.data;
}

export async function getFoundPost(id: string) {
  const response = await api.get<ApiSuccess<FoundPost>>(`/found-posts/${id}`);
  return response.data.data;
}

export async function listSightings(lostPostId: string) {
  const response = await api.get<ApiSuccess<Sighting[]>>(`/lost-posts/${lostPostId}/sightings`);
  return response.data.data;
}

export async function listAds() {
  const response = await api.get<ApiSuccess<Ad[]>>('/ads');
  return response.data.data;
}
