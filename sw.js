// Service worker: cache-first app shell. Dictionary .mdx/.mdd files live in IndexedDB.
// Bump version whenever app shell changes!
const CACHE = 'mdx-dict-v40';
const ASSETS = [
  './',
  './index.html',
  './robots.txt',
  './NOTICE.md',
  './css/style.css',
  './js/mdict.js',
  './js/db.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data-loading-guide.md',
  // bundled demo dictionary — precached so the test sample works offline
  './samples/sample.mdx',
  './samples/sample.mdd',
  // free fallback dictionaries — used when the full dicts/ folder is absent
  './samples/wordnet31.mdx',
  './samples/simple-en.mdx',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Never cache the bundled dictionary files (multi-GB) — they go straight to
  // IndexedDB on load and would blow up the Cache Storage quota otherwise.
  // remote-config.json is optional (private deployments only) — never cache it.
  const path = new URL(e.request.url).pathname;
  if (path.includes('/dicts/') || path.endsWith('/remote-config.json')) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit || fetch(e.request).then((resp) => {
        // Cache ONLY successful responses — a cached 404/HTML error page would
        // permanently shadow the real asset on the next deploy (this is what
        // broke the previous deployment: style.css/app.js were served from an
        // old broken deploy and never refreshed).
        if (!resp || !resp.ok || resp.type === 'opaque') return resp;
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => {
        // Offline fallback only for page navigations — never for assets like
        // css/js, where index.html would be parsed as garbage.
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
    )
  );
});
