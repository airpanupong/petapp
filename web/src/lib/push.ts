import {getWebPushConfig, removeWebPushSubscription, saveWebPushSubscription} from '../api/push.api';
import {isIOS, isStandalone} from './platform';

/** needs-install: iOS only offers web push to sites added to the Home Screen. */
export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIOS && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

function keyToBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return getPushState();
  // Must run before any await: Safari only shows the prompt inside the tap handler.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const config = await getWebPushConfig();
  if (!config.enabled || !config.public_key) throw new Error('ระบบแจ้งเตือนยังไม่พร้อมใช้งาน ลองใหม่ภายหลัง');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const options = {userVisibleOnly: true, applicationServerKey: keyToBytes(config.public_key)};
  let sub: PushSubscription;
  try {
    sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe(options));
  } catch {
    // A subscription made with an older server key cannot be reused.
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    sub = await reg.pushManager.subscribe(options);
  }
  await saveWebPushSubscription(sub.toJSON());
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const sub = pushSupported() ? await currentSubscription() : null;
  if (sub) {
    await removeWebPushSubscription(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return getPushState();
}

/** Re-link this browser's subscription to whoever is signed in now. */
export async function syncPushSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await saveWebPushSubscription(sub.toJSON());
}

/** Stop pushing the signed-out account's alerts to this browser. */
export async function detachPushSubscription() {
  if (!pushSupported()) return;
  const sub = await currentSubscription();
  if (sub) await removeWebPushSubscription(sub.endpoint);
}
