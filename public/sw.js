/**
 * ATSSupply - Dev Service Worker with Runtime Caching for local testing (ng serve)
 */

const DEV_CACHE_NAME = 'ats-supply-dev-cache-v1';
const DEV_API_CACHE_NAME = 'ats-supply-dev-api-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip WebSockets and non-GET requests
  if (request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // 1. API Catalog endpoints (Network-first with cache fallback)
  const isApiCatalog =
    url.pathname.includes('/api/products') ||
    url.pathname.includes('/api/price-tiers') ||
    url.pathname.includes('/api/customers') ||
    url.pathname.includes('/api/product-prices');

  if (isApiCatalog) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(DEV_API_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true, data: [] }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
    return;
  }

  // 2. SPA Navigation requests (Network-first, fallback to /index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(DEV_CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(DEV_CACHE_NAME);
          const indexResponse = await cache.match('/index.html');
          return indexResponse || new Response('Offline', { status: 200, headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  // 3. Static scripts, chunks and assets (with ignoreSearch for Vite dev timestamps)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async (cachedResponse) => {
      // If we are online, try network to keep Vite HMR fresh, but fallback to cache immediately if offline
      try {
        const networkResponse = await fetch(request);
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.origin === self.location.origin || url.hostname.includes('cdn'))
        ) {
          const responseToCache = networkResponse.clone();
          const cache = await caches.open(DEV_CACHE_NAME);
          // Store both exact request and path without search to survive &t= query params
          await cache.put(request, responseToCache);
        }
        return networkResponse;
      } catch (err) {
        // Offline fallback
        if (cachedResponse) {
          return cachedResponse;
        }
        const cache = await caches.open(DEV_CACHE_NAME);
        const match = await cache.match(request, { ignoreSearch: true });
        if (match) return match;

        // Return a benign empty JS/status rather than rejecting the fetch promise
        return new Response('', { status: 504, statusText: 'Offline Network Timeout' });
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});
