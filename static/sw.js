// GymPulse service worker.
//  1. Shows rest-timer and reminder alerts (Web Push) even when the phone is locked.
//  2. Keeps a copy of the app itself so it still opens with no signal at the gym.
//     It never stores your data (that is kept by the app in the page); API calls always go to the server.
const CACHE = 'gympulse-shell-v3';
const SHELL = ['/', '/static/anim.js', '/static/app.js', '/static/features.js', '/static/style.css', '/manifest.webmanifest',
  '/static/icons/icon-192.png', '/static/icons/apple-touch-icon.png',
  '/static/fonts/inter-latin-400-normal.woff2', '/static/fonts/inter-latin-500-normal.woff2',
  '/static/fonts/inter-latin-600-normal.woff2', '/static/fonts/inter-latin-700-normal.woff2',
  '/static/fonts/inter-latin-800-normal.woff2', '/static/fonts/jetbrains-mono-latin-600-normal.woff2',
  '/static/fonts/jetbrains-mono-latin-700-normal.woff2', '/static/fonts/jetbrains-mono-latin-800-normal.woff2'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first (so updates always show), fall back to the saved copy when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz' || url.pathname.startsWith('/static/vendor/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? '/' : req;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
      if (res.ok) cache.put(key, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(key, { ignoreSearch: true });
      return hit || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

self.addEventListener('push', (event) => {
  let d = { title: "Time's up!", body: 'Your timer is done.' };
  try { d = Object.assign(d, event.data.json()); } catch (e) {}
  // a "rest started" note uses its own tag; when the rest ends, that note is cleared
  const tag = d.start ? 'gp-start' : 'gympulse-' + (d.title || '').toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 24);
  const clear = d.start ? Promise.resolve() : self.registration.getNotifications({ tag: 'gp-start' }).then((l) => l.forEach((n) => n.close())).catch(() => {});
  event.waitUntil(clear.then(() => self.registration.showNotification(d.title, {
    body: d.body,
    icon: '/static/icons/icon-192.png',
    tag: tag,
    renotify: true
  })));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  }));
});
