// DistroAI Service Worker — v3
// Network-first for HTML navigations and API calls to prevent stale ChunkLoadErrors across deployments.
// Cache-first only for immutable hashed Next.js static assets with graceful network catch.

const CACHE_NAME = 'distroai-v3';
const STATIC_ASSETS = [
    '/manifest.json',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // 1. Network-first for API calls
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // 2. Network-first for HTML / Navigation requests (Critical: ensures latest Next.js chunk references)
    const isNavigation = request.mode === 'navigate' ||
        (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

    if (isNavigation) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    // Fallback to cached root if available
                    return caches.match('/');
                })
        );
        return;
    }

    // 3. Cache-first for Next.js immutable static chunks (/_next/static/*)
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                }).catch(() => {
                    return caches.match(request);
                });
            })
        );
        return;
    }

    // 4. Stale-while-revalidate for other assets (images, icons, fonts)
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => null);

            return cached || fetchPromise;
        })
    );
});
