import {externalEffects, type Deps} from '../app';
import {placeholders} from '../lib/db';
import {sendWebPush, type PushSubscription} from './webpush';

const REFERENCE_PATHS: Record<string, string> = {
  lost_post: '/lost/',
  found_post: '/found/',
  pet: '/pets/',
  conversation: '/chat/',
};

export type PushData = {type?: string; reference_type?: string; reference_id?: string};

export function webPushEnabled(env: Env): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function notificationUrl(data: PushData | undefined): string {
  const prefix = REFERENCE_PATHS[data?.reference_type ?? ''];
  return prefix && data?.reference_id ? `${prefix}${data.reference_id}` : '/notifications';
}

async function deliver(deps: Deps, subscriptions: PushSubscription[], payload: string): Promise<void> {
  const {env} = deps;
  const vapid = {publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT};
  const expired: string[] = [];
  await Promise.all(
    subscriptions.map(async sub => {
      try {
        const status = await sendWebPush(sub, payload, vapid);
        if (status === 404 || status === 410) expired.push(sub.endpoint);
      } catch (err) {
        console.warn(JSON.stringify({msg: 'web push error', endpoint: sub.endpoint.slice(0, 40), error: String(err)}));
      }
    }),
  );
  if (expired.length) {
    await deps.db.run(`DELETE FROM web_push_subscriptions WHERE endpoint IN (${placeholders(expired.length)})`, ...expired);
  }
}

/** Queues web push delivery to every browser of the user; returns how many subscriptions were targeted. */
export async function sendWebPushToUser(
  deps: Deps,
  userId: string,
  title: string,
  body: string,
  data?: PushData,
  force = false,
): Promise<number> {
  if (!webPushEnabled(deps.env) || !(force || externalEffects(deps.env))) return 0;
  const rows = await deps.db.all<PushSubscription>(
    'SELECT endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = ?',
    userId,
  );
  if (!rows.length) return 0;
  const payload = JSON.stringify({
    title,
    body,
    url: notificationUrl(data),
    tag: `${data?.reference_type || 'general'}:${data?.reference_id || ''}`,
  });
  // Push services can be slow; never hold the API response for them.
  deps.waitUntil(deliver(deps, rows, payload));
  return rows.length;
}

/** Mobile push (FCM) is not configured on the Python API either, so only web push is sent. */
export async function sendPushToUser(deps: Deps, userId: string, title: string, body: string, data?: PushData) {
  try {
    return await sendWebPushToUser(deps, userId, title, body, data);
  } catch (err) {
    console.warn(JSON.stringify({msg: 'web push dispatch failed', userId, error: String(err)}));
    return 0;
  }
}
