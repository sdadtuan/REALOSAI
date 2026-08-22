/**
 * RNOS-41 / WIN-1 — PWA service worker (app shell + lead list fallback).
 * Do not cache /_next/static — hashed assets use immutable cache; SW cache caused ChunkLoadError after deploy.
 */
const CACHE = 'ptt-ops-pwa-v4';
const SHELL_URLS = ['/', '/crm/leads', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { credentials: 'same-origin' })))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: 'PTT CRM', body: event.data?.text() ?? 'Lead B2B mới' };
    }
  })();
  const title = payload.title ?? 'PTT CRM';
  const options = {
    body: payload.body ?? 'Lead B2B mới',
    data: payload.data ?? {},
    icon: '/icons/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/crm/b2b/leads';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Next.js hashed chunks — always network; browser/nginx immutable cache is enough.
  if (url.pathname.startsWith('/_next/static/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname.startsWith('/crm/leads')) {
            void caches.open(CACHE).then((cache) => cache.put('/crm/leads', response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          if (url.pathname.startsWith('/crm/leads/')) {
            const leadList = await cache.match('/crm/leads');
            if (leadList) return leadList;
          }
          const fallback = await cache.match('/crm/leads');
          if (fallback) return fallback;
          const login = await cache.match('/login');
          if (login) return login;
          return new Response('Offline — mở lại khi có mạng.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }),
    );
  }
});
