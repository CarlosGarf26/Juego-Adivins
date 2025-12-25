const CACHE_NAME = 'chilango-guess-v3';
// Only cache purely static assets eagerly. Code files should be Network First.
const STATIC_ASSETS = [
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/1865/1865626.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Calls: Network Only
  if (url.pathname.includes('generativelanguage') || url.pathname.includes('googleapis')) {
    return;
  }

  // 2. Navigation (HTML) and Code (JS/TSX): Network First
  // This is safer for development environments to ensure we get the latest transpiled code.
  if (event.request.mode === 'navigate' || 
      url.pathname.endsWith('.tsx') || 
      url.pathname.endsWith('.ts') || 
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
      
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate for other assets (Images, Fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
          // If fetch fails, we just return undefined here, allowing cachedResponse to be returned
      });
      return cachedResponse || fetchPromise;
    })
  );
});