// GymPulse service worker: shows rest-timer alerts (Web Push) even when the
// phone is locked. It does not cache anything, so updates always show up.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = { title: "Time's up!", body: 'Your timer is done.' };
  try { d = Object.assign(d, event.data.json()); } catch (e) {}
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: '/static/icons/icon-192.png',
    tag: 'gympulse-timer',
    renotify: true
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  }));
});
