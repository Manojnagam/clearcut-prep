// ClearCut Service Worker
// NOTE: Scheduled notifications (via setTimeout) will only fire while this
// service worker is running — i.e. while the browser tab is open or the PWA
// is active in the foreground/background. On Android Chrome with the PWA
// installed, background execution is more reliable but still not guaranteed
// after the browser is fully closed. There is no Web Push server here, so
// this is a best-effort client-side reminder only.

const CACHE = 'clearcut-v4';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete old cache versions so deploys are picked up immediately
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request)).catch(() => caches.match('/index.html'))
  );
});

// Receive scheduled notification request from main app.
// The delay is calculated in the main thread so the notification fires at the
// user's chosen time. A new message is sent each time the app is opened.
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/manifest.json',
        badge: '/manifest.json',
        tag: 'daily-reminder',
        renotify: true,
        vibrate: [200, 100, 200],
        actions: [{ action: 'open', title: 'Open ClearCut' }]
      });
    }, delay);
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow('/');
  }));
});
