/* Ugent service worker: caches the whole app so it opens and works with no data connection. */
const CACHE = 'ugent-v1';
const FILES = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg',
  './js/i18n.js', './js/store.js', './js/planner.js', './js/agent.js', './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Serve from cache straight away (fast on slow or expensive data), then refresh the cache in the background
// so the next launch gets any update. With no connection, the cached app keeps working.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || cache.match('./index.html');
  }));
});
