// Pet haii service worker: web push only. No fetch handler, so every request
// still goes to the network and a deploy can never be masked by a stale cache.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {body: event.data ? event.data.text() : ''};
  }
  const title = data.title || 'Pet haii';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: {url: data.url || '/notifications'},
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
