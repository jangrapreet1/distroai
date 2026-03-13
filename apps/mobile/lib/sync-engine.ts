import NetInfo from '@react-native-community/netinfo';
import { processQueue } from './offline-queue';
import { refreshLocalCache } from './local-cache';
import { apiClient } from './api-client';
import { useSyncStore } from '@/stores/sync.store';

export interface SyncResult {
    pushed: number;
    failed: number;
    cacheRefreshed: boolean;
}

let lastSyncAttempt = 0;
const MIN_SYNC_INTERVAL_MS = 10_000; // 10s backoff

export async function syncOnReconnect(): Promise<SyncResult> {
    const store = useSyncStore.getState();
    if (store.isSyncing) return { pushed: 0, failed: 0, cacheRefreshed: false };

    const now = Date.now();
    if (now - lastSyncAttempt < MIN_SYNC_INTERVAL_MS) {
        return { pushed: 0, failed: 0, cacheRefreshed: false };
    }
    lastSyncAttempt = now;

    store.setIsSyncing(true);
    store.setSyncError(null);

    try {
        const queueResult = await processQueue(apiClient);
        await refreshLocalCache(apiClient);
        store.setLastSyncAt(new Date());
        store.refreshPendingCount();
        return { pushed: queueResult.processed, failed: queueResult.failed, cacheRefreshed: true };
    } catch (err: any) {
        store.setSyncError(err?.message || 'Sync failed');
        return { pushed: 0, failed: 0, cacheRefreshed: false };
    } finally {
        store.setIsSyncing(false);
    }
}

let unsubscribe: (() => void) | null = null;

export function startNetworkListener(onSync?: (result: SyncResult) => void): void {
    unsubscribe = NetInfo.addEventListener(async (state) => {
        if (state.isConnected && state.isInternetReachable) {
            const result = await syncOnReconnect();
            onSync?.(result);
        }
    });
}

export function stopNetworkListener(): void {
    unsubscribe?.();
    unsubscribe = null;
}
