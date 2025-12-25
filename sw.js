
const CACHE_NAME = 'chilango-guess-v13';
// Lista explicita de assets criticos
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/1865/1865626.png',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://esm.sh/@google/genai@0.2.1'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => 
           cache.add(url).catch(e => console.error(`Failed to cache ${url}`, e))
        )
      );
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

  // No cachear llamadas a la API de Gemini
  if (url.pathname.includes('generativelanguage')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
      });
    }).catch(() => {
        // En caso de fallo total, y si es la navegación principal, devolver index.html de caché
        if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
        }
    })
  );
});
