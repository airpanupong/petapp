import axios, {AxiosError, InternalAxiosRequestConfig} from 'axios';

import {API_BASE_URL} from '../config/env';
import {ApiErrorBody, ApiSuccess, AuthPayload} from '../types/api';
import {clearSession, getMemorySession, loadSession, saveSession} from '../services/session';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {'Content-Type': 'application/json'},
});

const refreshApi = axios.create({baseURL: API_BASE_URL, timeout: 15_000});
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const session = getMemorySession() ?? (await loadSession());
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  const session = getMemorySession() ?? (await loadSession());
  if (!session?.refreshToken) {
    return null;
  }
  try {
    const response = await refreshApi.post<ApiSuccess<AuthPayload>>('/auth/refresh', {
      refresh_token: session.refreshToken,
    });
    const data = response.data.data;
    await saveSession({accessToken: data.access_token, refreshToken: data.refresh_token});
    return data.access_token;
  } catch {
    await clearSession();
    return null;
  }
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & {_retry?: boolean}) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const accessToken = await refreshPromise;
      if (accessToken) {
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
