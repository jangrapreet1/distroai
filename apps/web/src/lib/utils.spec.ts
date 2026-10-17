import { formatDate, formatDateTime, timeAgo, greeting, getPendingQty } from './utils';

describe('formatDate', () => {
    it('should format a date string to dd MMM yyyy', () => {
        const result = formatDate('2026-03-04T10:00:00Z');
        expect(result).toMatch(/04 Mar 2026/);
    });

    it('should handle Date objects', () => {
        const result = formatDate(new Date('2026-01-15'));
        expect(result).toMatch(/15 Jan 2026/);
    });
});

describe('formatDateTime', () => {
    it('should include time in the formatted string', () => {
        const result = formatDateTime('2026-03-04T14:30:00Z');
        expect(result).toContain('04 Mar 2026');
    });
});

describe('timeAgo', () => {
    it('should return a human-readable time difference', () => {
        const recent = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
        const result = timeAgo(recent);
        expect(result).toContain('ago');
    });
});

describe('greeting', () => {
    it('should return a greeting based on the time of day', () => {
        const result = greeting();
        expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(result);
    });
});

describe('getPendingQty', () => {
    it('returns correct pending quantity for normal unfulfilled items', () => {
        expect(getPendingQty({ orderedQty: 10, deliveredQty: 4, pendingQty: 6 })).toBe(6);
    });

    it('safely recovers pending quantity when pendingQty defaulted to 0 on legacy/unmigrated items', () => {
        // This was the exact bug reported on PO-00002!
        expect(getPendingQty({ orderedQty: 10, receivedQty: 0, pendingQty: 0 })).toBe(10);
        expect(getPendingQty({ orderedQty: 10, deliveredQty: 2, pendingQty: 0 })).toBe(8);
    });

    it('handles legacy quantity property instead of orderedQty', () => {
        expect(getPendingQty({ quantity: 15, deliveredQty: 5 })).toBe(10);
    });

    it('accounts for cancelled quantities', () => {
        expect(getPendingQty({ orderedQty: 10, deliveredQty: 4, cancelledQty: 2 })).toBe(4);
    });

    it('returns 0 when fully fulfilled or cancelled', () => {
        expect(getPendingQty({ orderedQty: 10, deliveredQty: 10, pendingQty: 0 })).toBe(0);
        expect(getPendingQty({ orderedQty: 10, deliveredQty: 7, cancelledQty: 3 })).toBe(0);
    });

    it('returns 0 for null or undefined input', () => {
        expect(getPendingQty(null)).toBe(0);
        expect(getPendingQty(undefined)).toBe(0);
    });
});
