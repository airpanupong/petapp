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

export async function forgotPassword(email: string) {
  const response = await api.post<ApiSuccess<{sent: boolean; expires_in: number; resend_in: number}>>('/auth/password/forgot', {email});
  return response.data.data;
}

export async function verifyResetCode(email: string, code: string) {
  await api.post('/auth/password/verify', {email, code});
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const response = await api.post<ApiSuccess<AuthPayload>>('/auth/password/reset', {email, code, new_password: newPassword});
  return response.data.data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', {refresh_token: refreshToken});
}

export async function me() {
  const response = await api.get<ApiSuccess<User>>('/users/me');
  return response.data.data;
}
