const CACHE = 'reformia-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);

self.addEventListener('activate', e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
);

self.addEventListener('fetch', e => {
  if (e.request.url.includes('ubidots.com')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
