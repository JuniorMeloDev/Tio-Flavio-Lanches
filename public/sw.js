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

  // Combinamos as duas ações (mostrar notificação E enviar mensagem) em um único Promise
  const notificationPromise = self.registration.showNotification(title, options);
  
  const postMessagePromise = self.clients.matchAll({ 
    includeUncontrolled: true, 
    type: 'window' 
  }).then(clientsArr => {
      for (const client of clientsArr) {
        client.postMessage({ type: 'NEW_ORDER', payload });
      }
  });

  // Aguardamos as duas promessas terminarem
  event.waitUntil(Promise.all([notificationPromise, postMessagePromise]));
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
