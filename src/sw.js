/**
 * ATSSupply - Custom Offline-First Service Worker
 * Generated via scripts/build-sw.mjs
 */

const CACHE_NAME = '__CACHE_VERSION__';
const API_CACHE_NAME = 'ats-supply-api-v1';
const PRECACHE_ASSETS = __PRECACHE_MANIFEST__;

// Install: Precache App Shell and Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        const urlsToCache = Array.isArray(PRECACHE_ASSETS)
          ? PRECACHE_ASSETS.map((item) => (typeof item === 'string' ? item : item.url))
          : [];
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('[SW] Precache failed:', err);
      })
  );
});

// Activate: Clean up stale caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith('ats-supply-v') && name !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }
            return Promise.resolve(false);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (handled by OfflineSyncService via IndexedDB)
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: API Catalog requests (Network-first with cache fallback)
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
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          return new Response(JSON.stringify({ success: false, offline: true, data: [] }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
    return;
  }

  // Strategy 2: SPA Navigation (Network first, fallback to cached index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const indexResponse = await cache.match('/index.html');
        return indexResponse || Response.error();
      })
    );
    return;
  }

  // Strategy 3: Static Assets & Precached resources (Cache-first with network fallback)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.origin === self.location.origin || url.hostname.includes('cdn'))
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(request);
          if (fallback) return fallback;
          return Response.error();
        });
    })
  );
});

// Communication with Angular frontend
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync Event (Triggered by browser when internet recovers)
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
