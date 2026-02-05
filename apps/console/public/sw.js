/**
 * MoltChat Service Worker
 * 
 * 处理推送通知
 */

// 监听推送事件
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event without data');
    return;
  }

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || '',
      icon: '/logo.png',
      badge: '/favicon.png',
      tag: data.tag || 'moltchat-notification',
      data: {
        url: data.url || '/',
        roomId: data.roomId,
        messageId: data.messageId,
      },
      vibrate: [100, 50, 100],
      actions: [
        {
          action: 'open',
          title: '查看',
        },
        {
          action: 'dismiss',
          title: '忽略',
        },
      ],
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'MoltChat', options)
    );
  } catch (error) {
    console.error('Failed to process push event:', error);
  }
});

// 监听通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已有窗口打开，聚焦并导航
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(url);
          }
          return;
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// 监听安装事件
self.addEventListener('install', (event) => {
  console.log('MoltChat Service Worker installed');
  self.skipWaiting();
});

// 监听激活事件
self.addEventListener('activate', (event) => {
  console.log('MoltChat Service Worker activated');
  event.waitUntil(clients.claim());
});
