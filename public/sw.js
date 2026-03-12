const CACHE = 'qr-v2';
const SCOPE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const APP_SHELL = [`${SCOPE}/`, `${SCOPE}/manifest.webmanifest`, `${SCOPE}/icon.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          if (response.ok) {
            caches.open(CACHE).then((cache) => cache.put(`${SCOPE}/`, cloned));
          }
          return response;
        })
        .catch(() => caches.match(`${SCOPE}/`))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            caches.open(CACHE).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(`${SCOPE}/`);
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
