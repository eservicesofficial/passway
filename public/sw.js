/*
 * Passway — Password Manager · Service Worker (passway-v2)
 *
 * Security rules (strict):
 *  - NEVER cache anything under /api/ (network only — no cache reads, no cache writes)
 *  - NEVER cache non-GET requests (POST/PATCH/PUT/DELETE pass straight through)
 *  - NEVER cache cross-origin requests
 *  - NEVER cache responses with status !== 200 or non-"basic" (non-same-origin) responses
 *
 * Freshness rules:
 *  - /_next/static/ chunks are NETWORK-FIRST (cache only as offline fallback) so
 *    app updates are never masked by a stale cache. Icons stay cache-first (immutable).
 */

const VERSION = 'passway-v3';
const CACHE_PREFIX = 'passway-';

/** Precached on install: offline app shell + manifest + core icons. */
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ------------------------------ install ------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Precache each asset individually so one failure doesn't abort install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (isCacheable(response)) {
              await cache.put(url, response);
            }
          } catch {
            // Asset unavailable right now — it can still be filled at runtime.
          }
        })
      );
    })()
  );
});

/* ------------------------------ activate ----------------------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete every stale cache that shares our prefix (e.g. passway-v0).
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== VERSION)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/* ------------------------------ messages ----------------------------- */

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* -------------------------------- fetch ------------------------------ */

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. NEVER touch non-GET requests (POST/PATCH/PUT/DELETE…) — straight to network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 2. NEVER touch cross-origin requests — no cache reads, no cache writes.
  if (url.origin !== self.location.origin) return;

  // 3. NEVER cache (read or write) anything under /api/ — always network.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  // App-shell navigations: network-first, fall back to cached "/" when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Icons/manifest-like static assets are immutable: cache-first with background fill.
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  // Build chunks: NETWORK-FIRST (cache is only an offline fallback) — guarantees
  // a fresh app after every deploy/dev rebuild. Offline capability is preserved
  // because every successful fetch is written to the cache in the background.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(networkFirst(event, request));
    return;
  }

  // Everything else (same-origin GET): network-first with cache fallback.
  event.respondWith(networkFirst(event, request));
});

/* ---------------------------- strategies ----------------------------- */

/** A response may be cached only if it is a 200 from our own origin. */
function isCacheable(response) {
  return Boolean(response && response.status === 200 && response.type === 'basic');
}

/** Write to the versioned cache without blocking the response. */
function putInCache(event, request, response) {
  const put = caches
    .open(VERSION)
    .then((cache) => cache.put(request, response))
    .catch(() => {
      /* cache write failures must never break the response */
    });
  if (event && typeof event.waitUntil === 'function') {
    event.waitUntil(put);
  }
}

/** Navigations: network-first, offline fallback to the cached app shell. */
async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match('/');
    if (cached) return cached;
    return offlineResponse();
  }
}

/** /_next/static/ + /icons/: serve from cache, fill cache in the background on miss. */
async function cacheFirst(event, request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    putInCache(event, request, response.clone());
  }
  return response;
}

/** All other same-origin GETs: try network, fall back to cache when offline. */
async function networkFirst(event, request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      putInCache(event, request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineResponse();
  }
}

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain' },
  });
}
