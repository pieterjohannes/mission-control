const CACHE_NAME = 'mc-shell-v1';
const SHELL_ASSETS = ['/', '/projects', '/ideas', '/activity', '/domains', '/explorer'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // Shell: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
