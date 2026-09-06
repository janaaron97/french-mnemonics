// Cache strategy, in one line each:
//   navigation  — network first, so a deploy is picked up the moment you are online
//   same-origin — cache first, because Vite content-hashes every built asset
//   everything else (Supabase, fonts, /api) — straight to the network, never stored
// Bump VERSION to drop every cache on the next activation.
const VERSION = 'echo-v1';
const SHELL = '/';

self.addEventListener('install', e => {
  // Warming the shell is a nicety; failing it must not stop activation, because
  // an inactive worker has no fetch handler and Chrome then refuses to install.
  e.waitUntil(
    caches.open(VERSION).then(c => c.add(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  // Install check probes must reach the network, or they would report this
  // worker's own cache back to itself and hide whatever the server is doing.
  if (url.searchParams.has('__probe')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          e.waitUntil(caches.open(VERSION).then(c => c.put(SHELL, copy)));
          return res;
        })
        .catch(() => caches.match(SHELL).then(hit => hit || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        e.waitUntil(caches.open(VERSION).then(c => c.put(req, copy)));
      }
      return res;
    }))
  );
});
