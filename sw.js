// ─────────────────────────────────────────
//  VICO LENGUA — Service Worker v2
//  Usa rutas RELATIVAS para funcionar en
//  cualquier subdirectorio de GitHub Pages
// ─────────────────────────────────────────
const CACHE_NAME = 'vico-lengua-v2';

// Rutas relativas al SW (funciona en /repo/ también)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600&display=swap'
];

// ── INSTALL: pre-cachear archivos core ──
self.addEventListener('install', event => {
  self.skipWaiting(); // Activar inmediatamente sin esperar
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll falla si cualquier recurso falla, usamos add individual
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // Tomar control de todas las pestañas
  );
});

// ── FETCH: estrategia Cache-First con fallback a red ──
self.addEventListener('fetch', event => {
  // Solo manejar GET, ignorar POST/otros
  if (event.request.method !== 'GET') return;

  // No interceptar llamadas a APIs externas (Gemini, Groq, RSS)
  const url = new URL(event.request.url);
  const isApiCall = [
    'generativelanguage.googleapis.com',
    'api.groq.com',
    'api.allorigins.win',
    'feeds.bbci.co.uk',
    'rss.nytimes.com',
    'techcrunch.com',
    'rss.arxiv.org'
  ].some(domain => url.hostname.includes(domain));

  if (isApiCall) {
    // APIs siempre desde la red (sin cache)
    event.respondWith(fetch(event.request));
    return;
  }

  // Archivos locales: Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Solo cachear respuestas válidas
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback: devolver index.html para navegación
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
