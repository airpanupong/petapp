import {api} from './client';
import {ApiSuccess} from '../types/api';

export async function getWebPushConfig() {
  const r = await api.get<ApiSuccess<{enabled: boolean; public_key: string | null}>>('/push/web/config');
  return r.data.data;
}

export async function saveWebPushSubscription(subscription: PushSubscriptionJSON) {
  await api.post('/push/web/subscriptions', {endpoint: subscription.endpoint, keys: subscription.keys});
}

export async function removeWebPushSubscription(endpoint: string) {
  await api.post('/push/web/unsubscribe', {endpoint});
}

export async function sendTestWebPush() {
  const r = await api.post<ApiSuccess<{sent: number}>>('/push/web/test');
  return r.data.data.sent;
}
