/**
 * Web shell URL.
 * - Production: https://pethaii.com
 * - Local Vite on device/simulator: http://<your-lan-ip>:5173
 *   (Android emulator → http://10.0.2.2:5173)
 */
export const WEB_BASE_URL = 'https://pethaii.com';

/** Origins the WebView may stay in (others open in the system browser). */
export const ALLOWED_HOSTS = new Set([
  'pethaii.com',
  'www.pethaii.com',
  'cf.pethaii.com',
  'api.pethaii.com',
  'localhost',
  '127.0.0.1',
  '10.0.2.2',
]);
