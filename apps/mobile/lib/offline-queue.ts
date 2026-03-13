import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'distroai-field' });

export interface QueuedAction {
    id: string;
    type: 'CREATE_ORDER' | 'UPDATE_ORDER' | 'LOG_VISIT' | 'CHECK_IN' | 'CHECK_OUT' | 'RECORD_COLLECTION' | 'CREATE_RETURN';
    payload: any;
    createdAt: string;
    retries: number;
}

const QUEUE_KEY = 'offline_queue';

function getQueue(): QueuedAction[] {
    const raw = storage.getString(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveQueue(queue: QueuedAction[]): void {
    storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>): string {
    const queue = getQueue();
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    queue.push({ ...action, id, createdAt: new Date().toISOString(), retries: 0 });
    saveQueue(queue);
    return id;
}

export function dequeue(id: string): void {
    saveQueue(getQueue().filter((a) => a.id !== id));
}

export function getPendingActions(): QueuedAction[] {
    return getQueue();
}

export function getPendingCount(): number {
    return getQueue().length;
}

export function getQueuedByType(type: QueuedAction['type']): QueuedAction[] {
    return getQueue().filter((a) => a.type === type);
}

const ACTION_ENDPOINTS: Record<QueuedAction['type'], { method: 'post' | 'patch'; path: string }> = {
    CREATE_ORDER: { method: 'post', path: '/api/v1/orders' },
    UPDATE_ORDER: { method: 'patch', path: '/api/v1/orders' },
    LOG_VISIT: { method: 'post', path: '/api/v1/visits' },
    CHECK_IN: { method: 'post', path: '/api/v1/attendance/check-in' },
    CHECK_OUT: { method: 'post', path: '/api/v1/attendance/check-out' },
    RECORD_COLLECTION: { method: 'post', path: '/api/v1/payments' },
    CREATE_RETURN: { method: 'post', path: '/api/v1/returns' },
};

export async function processQueue(apiClient: any): Promise<{ processed: number; failed: number }> {
    const queue = getQueue();
    let processed = 0;
    let failed = 0;

    for (const action of queue) {
        const endpoint = ACTION_ENDPOINTS[action.type];
        if (!endpoint) { failed++; continue; }

        try {
            await apiClient[endpoint.method](endpoint.path, action.payload);
            dequeue(action.id);
            processed++;
        } catch (err: any) {
            if (err?.response?.status >= 400 && err?.response?.status < 500) {
                // Client error — won't succeed on retry, discard
                dequeue(action.id);
                failed++;
            } else {
                // Network/server error — keep in queue, increment retries
                const q = getQueue();
                const idx = q.findIndex((a) => a.id === action.id);
                if (idx >= 0) {
                    q[idx].retries++;
                    if (q[idx].retries > 10) { q.splice(idx, 1); failed++; }
                    saveQueue(q);
                }
                failed++;
            }
        }
    }

    return { processed, failed };
}
