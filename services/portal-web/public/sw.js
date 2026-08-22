/**
 * RNOS-M2 — Portal PWA service worker (dashboard shell + push handler stub).
 */
const CACHE = 'ptt-portal-pwa-v1';
const SHELL_URLS = ['/dashboard', '/login'];

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
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: 'PTT Portal', body: event.data?.text() ?? 'Thông báo mới' };
    }
  })();
  const title = payload.title ?? 'PTT Portal';
  const options = {
    body: payload.body ?? 'Có mục cần duyệt',
    data: payload.data ?? {},
    icon: '/icons/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/notifications';
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

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) void cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname.startsWith('/dashboard')) {
            void caches.open(CACHE).then((cache) => cache.put('/dashboard', response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const fallback = await cache.match('/dashboard');
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
