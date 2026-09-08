const CACHE_NAME = 'productivity-planner-v8';
const urlsToCache = [
  './',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force new service worker to activate immediately on iOS & Android
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Cache failed:', err);
      })
  );
});

// Message handler (skipWaiting + 11 PM notification trigger)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  // Triggered by the main page at ~11 PM to show planning notification
  if (event.data && event.data.type === 'SHOW_11PM_NOTIFICATION') {
    const { pendingHabits, taskSummary } = event.data;

    let bodyLines = ['📋 Time to plan your next day!'];
    if (pendingHabits && pendingHabits.length > 0) {
      bodyLines.push('🌱 Pending habits: ' + pendingHabits.join(', '));
    }
    if (taskSummary) {
      bodyLines.push('⏰ ' + taskSummary);
    }

    event.waitUntil(
      self.registration.showNotification('🌙 Manage Well — Evening Review', {
        body: bodyLines.join('\n'),
        icon: './img.png',
        badge: './img.png',
        tag: 'daily-planning-11pm',
        renotify: false,
        requireInteraction: true,
        actions: [
          { action: 'open', title: '📖 Open App' },
          { action: 'dismiss', title: '✖ Dismiss' }
        ]
      })
    );
  }
});

// Notification click: open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

// Fetch event - Network-First for HTML/navigation (critical for iOS updates), Cache-First for static assets
self.addEventListener('fetch', (event) => {
  const isHTMLRequest = event.request.mode === 'navigate' || 
                        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isHTMLRequest) {
    // Network-First for main page HTML so iOS devices immediately fetch code updates when online
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-First with Network Fallback for static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
