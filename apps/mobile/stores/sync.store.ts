import { create } from 'zustand';
import { getPendingCount } from '@/lib/offline-queue';

interface SyncState {
    isSyncing: boolean;
    lastSyncAt: Date | null;
    pendingCount: number;
    syncError: string | null;

    setIsSyncing: (v: boolean) => void;
    setLastSyncAt: (d: Date) => void;
    setSyncError: (e: string | null) => void;
    refreshPendingCount: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: getPendingCount(),
    syncError: null,

    setIsSyncing: (v) => set({ isSyncing: v }),
    setLastSyncAt: (d) => set({ lastSyncAt: d, syncError: null }),
    setSyncError: (e) => set({ syncError: e }),
    refreshPendingCount: () => set({ pendingCount: getPendingCount() }),
}));
