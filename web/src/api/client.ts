import axios, {AxiosError, InternalAxiosRequestConfig} from 'axios';

import {API_BASE_URL, SUPPORT_EMAIL} from '../lib/config';
import {ApiErrorBody, ApiSuccess, AuthPayload} from '../types/api';
import {clearSession, getMemorySession, loadSession, saveSession} from '../lib/session';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: {'Content-Type': 'application/json'},
});

const refreshApi = axios.create({baseURL: API_BASE_URL, timeout: 20_000});
let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const session = getMemorySession() ?? (await loadSession());
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

export async function refreshSession(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshAccessToken(): Promise<string | null> {
  const session = getMemorySession() ?? (await loadSession());
  if (!session?.refreshToken) return null;
  try {
    const response = await refreshApi.post<ApiSuccess<AuthPayload>>('/auth/refresh', {
      refresh_token: session.refreshToken,
    });
    const data = response.data.data;
    await saveSession({accessToken: data.access_token, refreshToken: data.refresh_token});
    return data.access_token;
  } catch {
    await clearSession();
    onSessionExpired?.();
    return null;
  }
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & {_retry?: boolean}) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.startsWith('/auth/')) {
      original._retry = true;
      const accessToken = await refreshSession();
      if (accessToken) {
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

const ERROR_TEXT: Record<string, string> = {
  'Account is disabled': `บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ ${SUPPORT_EMAIL}`,
  'Invalid email or password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Password is incorrect': 'รหัสผ่านไม่ถูกต้อง',
  'Super admin accounts cannot be deleted': 'ไม่สามารถลบบัญชี Super Admin ได้',
  'Only active posts can be hidden': 'ซ่อนได้เฉพาะประกาศที่เปิดอยู่',
  'Super admins cannot be blocked': 'ไม่สามารถบล็อก Super Admin ได้',
  'You cannot block yourself': 'ไม่สามารถบล็อกตัวเองได้',
  'Email is not registered': 'ไม่พบอีเมลนี้ในระบบ ตรวจสอบอีเมลอีกครั้ง หรือสมัครบัญชีใหม่',
  'Please wait before requesting a new code': 'เพิ่งส่งรหัสไป รอสักครู่แล้วค่อยขอใหม่',
  'Too many code requests. Try again later': 'ขอรหัสบ่อยเกินไป ลองใหม่ในอีก 1 ชั่วโมง',
  'Code expired. Request a new one': 'รหัสหมดอายุแล้ว กดส่งรหัสใหม่',
  'Too many attempts. Request a new code': 'กรอกรหัสผิดหลายครั้ง กดส่งรหัสใหม่',
  'Invalid code': 'รหัสยืนยันไม่ถูกต้อง',
  'Could not send email': 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง',
  'Email service is not configured': `ระบบส่งอีเมลยังไม่พร้อม กรุณาติดต่อ ${SUPPORT_EMAIL}`,
  'Image rejected: inappropriate content': 'รูปนี้มีเนื้อหาไม่เหมาะสม ไม่สามารถอัปโหลดได้',
  'Image rejected: no animal found': 'ไม่พบสัตว์ในรูป กรุณาใช้รูปที่เห็นน้องชัด ๆ',
  'Image check is unavailable, please try again': 'ตรวจรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  'Too many requests, please wait a moment': 'ส่งบ่อยเกินไป รอสักครู่แล้วลองใหม่',
  'Guest verification required': 'กรุณายืนยันว่าไม่ใช่บอทก่อนส่ง',
  'Guest verification expired, please verify again': 'การยืนยันหมดอายุ กรุณายืนยันอีกครั้ง',
  'Verification failed, please try again': 'ยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  'Guest reporting is not available from this network': 'ไม่สามารถแจ้งแบบไม่เข้าสู่ระบบจากเครือข่ายนี้ได้ กรุณาเข้าสู่ระบบ',
  'Daily guest limit reached, please sign in to continue': 'แจ้งแบบไม่เข้าสู่ระบบครบจำนวนของวันนี้แล้ว กรุณาเข้าสู่ระบบเพื่อแจ้งต่อ',
  'Guest reporting is paused for a while, please sign in to continue': 'ปิดรับแจ้งแบบไม่เข้าสู่ระบบชั่วคราว กรุณาเข้าสู่ระบบเพื่อแจ้ง',
  'This spot was just reported': 'คุณเพิ่งแจ้งจุดนี้ไปแล้ว',
  'Please upload the photos again': 'รูปไม่ถูกต้อง กรุณาเลือกรูปใหม่อีกครั้ง',
  'Request validation failed': 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
};

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message;
    return (message && ERROR_TEXT[message]) || message || error.message;
  }
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
