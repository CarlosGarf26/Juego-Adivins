const CACHE_NAME = 'chilango-guess-v12';
// Lista explicita de assets criticos incluyendo las librerias externas
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/1865/1865626.png',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://esm.sh/react-dom@18.2.0/client',
  'https://esm.sh/react-dom@18.2.0',
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/@google/genai@0.1.2'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Intentar cachear todo, pero no fallar si uno falla (especialmente útil para CDNs)
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

  // No cachear llamadas a la API de Gemini para que siempre intente traer nuevas palabras
  if (url.pathname.includes('generativelanguage')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si está en caché, devolverlo. Si no, buscar en red.
      return response || fetch(event.request).then(networkResponse => {
          // Solo cachear respuestas exitosas de tipo basic o cors
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
      });
    }).catch(() => {
        // Fallback offline (opcional, por ahora solo confiamos en la caché)
        console.log('Offline fetch failed:', event.request.url);
    })
  );
});