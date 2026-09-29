import {api} from './client';
import type {ApiSuccess} from '../types/api';

export type PlaceResult = {name: string; address: string; latitude: number; longitude: number};

export async function searchPlaces(q: string, near?: {latitude: number; longitude: number} | null, signal?: AbortSignal) {
  const response = await api.get<ApiSuccess<PlaceResult[]>>('/geo/search', {
    params: {q, lat: near?.latitude, lng: near?.longitude},
    signal,
  });
  return response.data.data;
}

export async function reverseGeocode(p: {latitude: number; longitude: number}) {
  const response = await api.get<ApiSuccess<{name: string}>>('/geo/reverse', {
    params: {lat: p.latitude, lng: p.longitude},
  });
  return response.data.data.name;
}
