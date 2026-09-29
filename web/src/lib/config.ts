export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'https://api.pethaii.com/api/v1';

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const DEFAULT_CENTER = {latitude: 13.7563, longitude: 100.5018};

export const SUPPORT_EMAIL = 'support@pethaii.com';

export const SUPPORT_LINE_ID = '@021vdjct';
export const SUPPORT_LINE_URL = `https://line.me/R/ti/p/${SUPPORT_LINE_ID}`;

export const SUPPORT_LINE_KEYWORDS = [
  {keyword: 'แจ้งปัญหา', description: 'พบปัญหาการใช้งานเว็บ หรือโพสต์ผิดปกติ'},
  {keyword: 'ช่วยทำคลิป', description: 'ให้ทีมช่วยทำคลิปตามหาน้องที่หาย'},
];

export function lineKeywordUrl(keyword: string) {
  return `https://line.me/R/oaMessage/${SUPPORT_LINE_ID}/?${encodeURIComponent(keyword)}`;
}
