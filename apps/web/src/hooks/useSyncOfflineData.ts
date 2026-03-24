import { useEffect, useCallback } from 'react';
import { db, ProductOffline } from '../lib/offline-db';
import apiClient from '../lib/api-client';

export function useSyncOfflineData() {
    const syncProducts = useCallback(async () => {
        try {
            if (!navigator.onLine) return; // Only sync if online

            const lastSyncStr = localStorage.getItem('distroai_last_sync_timestamp');
            const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;

            const res = await apiClient.get(`/api/v1/sync/products?lastSyncTimestamp=${lastSync}`);
            const data = res.data;

            if (data.products && data.products.length > 0) {
                const mappedProducts: ProductOffline[] = data.products.map((p: any) => {
                    const stockInfo = p.inventories?.map((i: any) => `${i.quantity} at ${i.warehouseId}`).join(', ') || 'Out of stock';
                    return {
                        id: p.id,
                        sku: p.sku,
                        name: p.name,
                        brand: p.brand,
                        mrp: p.mrp,
                        sellingPrice: p.sellingPrice,
                        stockInfo: stockInfo
                    };
                });

                await db.products.bulkPut(mappedProducts);
            }

            if (data.timestamp) {
                localStorage.setItem('distroai_last_sync_timestamp', data.timestamp.toString());
            }

        } catch (error) {
            console.error('Failed to sync offline products:', error);
        }
    }, []);

    useEffect(() => {
        // Initial sync when mounted (e.g., when user opens app)
        syncProducts();

        // Sync when device comes back online
        window.addEventListener('online', syncProducts);

        // Optional: periodic sync every 5 minutes while app is open
        const intervalId = setInterval(syncProducts, 5 * 60 * 1000);

        return () => {
            window.removeEventListener('online', syncProducts);
            clearInterval(intervalId);
        };
    }, [syncProducts]);
}
