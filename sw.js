/**
 * sw.js - Service Worker
 * Guarda en caché los archivos estáticos para que la app funcione offline
 * Estrategia: Cache First (primero busca en caché, si no, va a la red)
 */

const CACHE_NAME = 'menu-digital-v1';
const ARCHIVOS_A_CACHEAR = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Evento 'install': se dispara cuando el SW se instala por primera vez
self.addEventListener('install', event => {
  console.log('🛠️ Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARCHIVOS_A_CACHEAR);
    })
  );
  // Forzar a que el nuevo SW se active inmediatamente
  self.skipWaiting();
});

// Evento 'activate': se dispara cuando el SW se activa (después de instalar)
self.addEventListener('activate', event => {
  console.log('✅ Service Worker activado');
  // Limpiar cachés antiguas (si cambia el nombre CACHE_NAME)
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  // Tomar control de las páginas abiertas inmediatamente
  self.clients.claim();
});

// Evento 'fetch': intercepta todas las peticiones HTTP
self.addEventListener('fetch', event => {
  // Solo cachear peticiones GET (las normales)
  if (event.request.method !== 'GET') return;
  
  // ESTRATEGIA: Cache First (con fallback a red)
  event.respondWith(
    caches.match(event.request).then(response => {
      // Si está en caché, lo devuelve (rápido, offline)
      if (response) {
        return response;
      }
      
      // Si no está en caché, va a la red
      return fetch(event.request).then(respuestaRed => {
        // Guardar en caché para la próxima vez (solo si es exitosa)
        if (respuestaRed && respuestaRed.status === 200) {
          const responseToCache = respuestaRed.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return respuestaRed;
      }).catch(() => {
        // Si falla red y no hay caché, mostrar página offline personalizada
        // (opcional: retornar un mensaje amigable)
        return new Response('📴 Sin conexión. El menú ya está guardado en tu dispositivo.', {
          status: 503,
          statusText: 'Offline',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
