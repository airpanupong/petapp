import {api} from './client';
import {ApiSuccess, AuthPayload, User} from '../types/api';

export async function register(payload: {email: string; password: string; display_name: string}) {
  const response = await api.post<ApiSuccess<AuthPayload>>('/auth/register', payload);
  return response.data.data;
}

export async function login(payload: {email: string; password: string}) {
  const response = await api.post<ApiSuccess<AuthPayload>>('/auth/login', payload);
  return response.data.data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', {refresh_token: refreshToken});
}

export async function me() {
  const response = await api.get<ApiSuccess<User>>('/users/me');
  return response.data.data;
}
