// Offline shell + installable app. Pages and scripts: network first (always fresh), cache as fallback.
// Libraries and images: cache first (they're versioned by content and rarely change).
const V = 'lt-v1';
const SHELL = ['/', '/css/ui.css', '/config.js', '/js/app.js', '/js/core.js', '/js/shell.js', '/js/icons.js', '/js/lobby.js', '/js/hero3d.js',
  '/js/tool-page.js', '/js/pages.js', '/js/tools/kit.js', '/img/favicon.svg', '/img/icon-192.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/img/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
