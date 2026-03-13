import { haversineDistance, formatINR } from '../lib/utils';

// Mock MMKV for the offline queue tests
const mockStorage: Record<string, string> = {};
jest.mock('react-native-mmkv', () => ({
    MMKV: jest.fn().mockImplementation(() => ({
        getString: (key: string) => mockStorage[key] || undefined,
        set: (key: string, value: string) => { mockStorage[key] = value; },
        delete: (key: string) => { delete mockStorage[key]; },
        getAllKeys: () => Object.keys(mockStorage),
    })),
}));

// Import after mocking
import { enqueue, dequeue, getPendingActions, getPendingCount, getQueuedByType } from '../lib/offline-queue';

beforeEach(() => {
    // Clear all mock storage before each test
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

describe('Haversine Distance', () => {
    it('calculates Mumbai → Delhi ≈ 1150 km', () => {
        const mumbai = { lat: 19.076, lon: 72.877 };
        const delhi = { lat: 28.644, lon: 77.216 };
        const distance = haversineDistance(mumbai.lat, mumbai.lon, delhi.lat, delhi.lon);
        expect(distance).toBeGreaterThan(1100);
        expect(distance).toBeLessThan(1200);
    });

    it('same point returns 0', () => {
        expect(haversineDistance(19.076, 72.877, 19.076, 72.877)).toBe(0);
    });

    it('calculates Mumbai → Pune ≈ 120 km', () => {
        const distance = haversineDistance(19.076, 72.877, 18.52, 73.86);
        expect(distance).toBeGreaterThan(100);
        expect(distance).toBeLessThan(150);
    });
});

describe('formatINR', () => {
    it('formats Indian rupees', () => {
        expect(formatINR(125000)).toBe('₹1,25,000');
    });
});

describe('Offline Queue', () => {
    it('enqueues and retrieves actions in FIFO order', () => {
        enqueue({ type: 'CREATE_ORDER', payload: { item: 'first' } });
        enqueue({ type: 'RECORD_COLLECTION', payload: { item: 'second' } });
        enqueue({ type: 'LOG_VISIT', payload: { item: 'third' } });

        const actions = getPendingActions();
        expect(actions).toHaveLength(3);
        expect(actions[0].type).toBe('CREATE_ORDER');
        expect(actions[0].payload.item).toBe('first');
        expect(actions[1].type).toBe('RECORD_COLLECTION');
        expect(actions[2].type).toBe('LOG_VISIT');
    });

    it('reports correct pending count', () => {
        expect(getPendingCount()).toBe(0);
        enqueue({ type: 'CREATE_ORDER', payload: {} });
        enqueue({ type: 'CREATE_ORDER', payload: {} });
        expect(getPendingCount()).toBe(2);
    });

    it('dequeues by ID', () => {
        const id = enqueue({ type: 'CHECK_IN', payload: {} });
        expect(getPendingCount()).toBe(1);
        dequeue(id);
        expect(getPendingCount()).toBe(0);
    });

    it('filters by type with getQueuedByType', () => {
        enqueue({ type: 'CREATE_ORDER', payload: { a: 1 } });
        enqueue({ type: 'RECORD_COLLECTION', payload: { b: 2 } });
        enqueue({ type: 'CREATE_ORDER', payload: { c: 3 } });

        const orders = getQueuedByType('CREATE_ORDER');
        expect(orders).toHaveLength(2);
        expect(orders[0].payload.a).toBe(1);
        expect(orders[1].payload.c).toBe(3);
    });

    it('assigns unique IDs and timestamps', () => {
        const id1 = enqueue({ type: 'CREATE_ORDER', payload: {} });
        const id2 = enqueue({ type: 'CREATE_ORDER', payload: {} });
        expect(id1).not.toBe(id2);

        const actions = getPendingActions();
        expect(actions[0].createdAt).toBeDefined();
        expect(actions[0].retries).toBe(0);
    });
});

describe('Sync Engine Replay Order', () => {
    it('processes queue items in the order they were enqueued (FIFO)', () => {
        // Enqueue items in a specific order
        enqueue({ type: 'CHECK_IN', payload: { step: 1 } });
        enqueue({ type: 'CREATE_ORDER', payload: { step: 2 } });
        enqueue({ type: 'RECORD_COLLECTION', payload: { step: 3 } });

        const actions = getPendingActions();
        // Verify FIFO order is maintained
        expect(actions[0].payload.step).toBe(1);
        expect(actions[1].payload.step).toBe(2);
        expect(actions[2].payload.step).toBe(3);

        // Dequeue first item and verify order is maintained
        dequeue(actions[0].id);
        const remaining = getPendingActions();
        expect(remaining[0].payload.step).toBe(2);
        expect(remaining[1].payload.step).toBe(3);
    });
});
