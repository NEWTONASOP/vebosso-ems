// VEBOSSO EMS — web notifications (service worker)
// The browser runs this even when the app's tab is closed: it shows each
// notification the server sends, and opens the app when one is clicked.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch (e) {
    msg = { title: 'VEBOSSO EMS', body: event.data ? event.data.text() : '' };
  }
  const data = msg.data || {};
  event.waitUntil(
    self.registration.showNotification(msg.title || 'VEBOSSO EMS', {
      body: msg.body || '',
      icon: '/notification-icon.png',
      badge: '/notification-badge.png',
      data: data,
      // Same kind of notice replaces the last one instead of piling up.
      tag: data.type ? String(data.type) + (data.work_log_id || data.announcement_id || '') : undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (new URL(tab.url).origin === self.location.origin && 'focus' in tab) return tab.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
