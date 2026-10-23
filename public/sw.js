/* Service worker untuk notifikasi di layar HP (Web Push). Tidak menyimpan cache apa pun. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Absensi Zuhur dan Wirid', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Absensi Zuhur dan Wirid';
  const opsi = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/siswa' },
  };
  if (data.tag) opsi.tag = data.tag;
  // iOS mewajibkan setiap push menampilkan notifikasi
  event.waitUntil(self.registration.showNotification(title, opsi));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const daftar = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of daftar) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          await c.focus();
          if ('navigate' in c) {
            try { await c.navigate(url); } catch (e) { /* abaikan */ }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});