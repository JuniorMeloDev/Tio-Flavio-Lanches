// public/sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => clients.claim());

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || '🍔 Novo pedido recebido!';
  const options = {
    body: payload.body || 'Um novo pedido foi enviado para a cozinha.',
    icon: '/Logo.png',
    badge: '/Logo.png',
    vibrate: [200, 100, 200],
    data: { url: payload.url || '/cozinha' },
    tag: 'novo-pedido'
  };

  event.waitUntil(self.registration.showNotification(title, options));

  // Envia mensagem para a aba aberta (para tocar som local)
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clientsArr => {
      for (const client of clientsArr) {
        client.postMessage({ type: 'NEW_ORDER', payload });
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/cozinha';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const client of clientsArr) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
