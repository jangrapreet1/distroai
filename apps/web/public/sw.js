// DistroAI Service Worker — v6
// Ultra-resilient caching strategy:
// 1. COMPLETELY BYPASS Service Worker for Next.js internal RSC requests (?_rsc=...)
// 2. COMPLETELY BYPASS Service Worker for /api/* calls (handled by Axios / React Query / Dexie offline DB)
// 3. Network-first for HTML page navigations with offline fallback
// 4. Cache-first for immutable hashed static chunks (/_next/static/*)
// 5. Guaranteed valid Response object on ALL event.respondWith() calls (never resolves to null/undefined)

const CACHE_NAME = 'distroai-v6';
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

    // 1. Only intercept GET requests
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // 2. Only intercept same-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // 3. CRITICAL: Never intercept Next.js RSC router / prefetch requests
    // These include ?_rsc= queries used by Next.js App Router for dynamic component payloads.
    // Intercepting them or returning null causes "TypeError: Failed to convert value to 'Response'"
    if (url.searchParams.has('_rsc')) {
        return;
    }

    // 4. CRITICAL: Never intercept API calls or streaming endpoints
    // API calls are authenticated (Bearer tokens) and handled directly by Axios,
    // SWR, React Query, or Dexie offline DB. Never cache them in SW.
    if (url.pathname.startsWith('/api/') || url.pathname.includes('/stream')) {
        return;
    }

    // 5. Never intercept Next.js data routes or server actions
    if (url.pathname.startsWith('/_next/data/')) {
        return;
    }

    // 6. Never intercept media range requests
    if (request.headers.has('range')) {
        return;
    }

    // 7. Network-first for HTML / Page Navigations
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
                    const cachedRoot = await caches.match('/');
                    if (cachedRoot) return cachedRoot;
                    // Always return a valid Response, never null or undefined
                    return new Response(
                        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>DistroAI Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>DistroAI is currently offline</h2><p>Please check your internet connection.</p><button onclick="window.location.reload()" style="padding:10px 20px;cursor:pointer;">Retry</button></body></html>',
                        { status: 503, headers: { 'Content-Type': 'text/html' } }
                    );
                })
        );
        return;
    }

    // 8. Cache-first for Next.js immutable static chunks (/_next/static/*)
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(async () => {
                        const retryCached = await caches.match(request);
                        if (retryCached) return retryCached;
                        return new Response('', { status: 404, statusText: 'Static Asset Not Found' });
                    });
            })
        );
        return;
    }

    // 9. Stale-while-revalidate for local static assets (manifest, static icons, favicon)
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => null);

            if (cached) {
                // Background fetch updates cache, return cached immediately
                return cached;
            }

            return fetchPromise.then((response) => {
                if (response) return response;
                // Fallback valid Response if both cache and network fail
                return new Response('', { status: 404, statusText: 'Not Found' });
            });
        })
    );
});

// =========================================================
// 10. Web Push Notifications (iOS 16.4+ PWA / Android / Desktop)
// =========================================================
self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = { title: 'DistroAI Notification', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'DistroAI Notification';
    const options = {
        body: payload.body || 'You have a new update in DistroAI.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            url: payload.url || payload.data?.url || '/dashboard',
            ...payload.data,
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client && client.url.includes(self.location.origin)) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
