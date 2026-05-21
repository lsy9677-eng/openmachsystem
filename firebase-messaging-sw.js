/* 230MATCH Firebase Cloud Messaging Service Worker */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w",
  authDomain: "open-match-manager.firebaseapp.com",
  projectId: "open-match-manager",
  storageBucket: "open-match-manager.firebasestorage.app",
  messagingSenderId: "195671806262",
  appId: "1:195671806262:web:89691574839266cea1a397"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    '230MATCH 경기 알림';

  const options = {
    body:
      (payload.notification && payload.notification.body) ||
      (payload.data && payload.data.body) ||
      '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || '230match-notification',
    renotify: true
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
