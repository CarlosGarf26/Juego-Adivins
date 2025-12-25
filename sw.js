const CACHE_NAME = 'chilango-guess-v6';
const STATIC_ASSETS = [
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/1865/1865626.png',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
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

  // No cachear llamadas a la API
  if (url.pathname.includes('generativelanguage')) {
    return;
  }

  // Estrategia: Network First para archivos de código
  const isCode = url.pathname.endsWith('.tsx') || url.pathname.endsWith('.ts') || url.pathname.endsWith('.html') || url.pathname === '/';

  if (isCode) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchRes) => {
           if(fetchRes.status === 200) {
             const resClone = fetchRes.clone();
             caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
           }
           return fetchRes;
        });
      })
    );
  }
});