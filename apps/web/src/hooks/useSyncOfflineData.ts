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
        // Defer initial offline sync by 5 seconds so initial dashboard and UI queries load at full speed
        const initialTimer = setTimeout(() => {
            syncProducts();
        }, 5000);

        // Sync when device comes back online
        window.addEventListener('online', syncProducts);

        // Optional: periodic sync every 10 minutes while app is open
        const intervalId = setInterval(syncProducts, 10 * 60 * 1000);

        return () => {
            clearTimeout(initialTimer);
            window.removeEventListener('online', syncProducts);
            clearInterval(intervalId);
        };
    }, [syncProducts]);
}
