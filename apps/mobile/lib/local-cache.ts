import { storage } from './offline-queue';
import { apiClient as defaultApiClient } from './api-client';

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

const TTL_OVERRIDES: Record<string, number> = {
    products: 60 * 60 * 1000,  // 1 hour for product catalog
    route: 30 * 60 * 1000,     // 30 min for daily route
    customers: 30 * 60 * 1000, // 30 min
    settings: 60 * 60 * 1000,  // 1 hour
};

interface CacheEntry<T> {
    data: T;
    cachedAt: number;
}

export function getCached<T>(key: string): T | null {
    const raw = storage.getString(`cache:${key}`);
    if (!raw) return null;
    try {
        const entry: CacheEntry<T> = JSON.parse(raw);
        const ttl = TTL_OVERRIDES[key] || DEFAULT_TTL_MS;
        if (Date.now() - entry.cachedAt > ttl) return null;
        return entry.data;
    } catch { return null; }
}

export function setCache<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    storage.set(`cache:${key}`, JSON.stringify(entry));
}

export function clearCache(): void {
    const keys = storage.getAllKeys().filter((k) => k.startsWith('cache:'));
    keys.forEach((k) => storage.delete(k));
}

export async function getCachedOrFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cached = getCached<T>(key);
    if (cached !== null) return cached;

    try {
        const data = await fetchFn();
        setCache(key, data);
        return data;
    } catch {
        // If fetch fails, return stale cache if any
        const raw = storage.getString(`cache:${key}`);
        if (raw) {
            try {
                return JSON.parse(raw).data;
            } catch { /* fall through */ }
        }
        throw new Error(`No cached data and fetch failed for key: ${key}`);
    }
}

export async function refreshLocalCache(apiClient: any = defaultApiClient): Promise<void> {
    try {
        const [customers, products, route, settings] = await Promise.allSettled([
            apiClient.get('/api/v1/customers?limit=500'),
            apiClient.get('/api/v1/products?limit=1000'),
            apiClient.get('/api/v1/salesmen/me/route/today'),
            apiClient.get('/api/v1/org/settings'),
        ]);

        if (customers.status === 'fulfilled') setCache('customers', customers.value.data);
        if (products.status === 'fulfilled') setCache('products', products.value.data);
        if (route.status === 'fulfilled') setCache('route', route.value.data);
        if (settings.status === 'fulfilled') setCache('settings', settings.value.data);
    } catch {
        // Silently fail — cache keeps stale data
    }
}
