/**
 * Unit tests for Customer credit and grace logic.
 */

function canPlaceOrder(orderAmount: number, outstandingBalance: number, creditLimit: number): boolean {
    if (creditLimit === 0) return true; // 0 means no limit
    return (outstandingBalance + orderAmount) <= creditLimit;
}

function calculateOverdueDays(dueDate: Date, currentDate: Date = new Date()): number {
    const diffTime = currentDate.getTime() - dueDate.getTime();
    if (diffTime <= 0) return 0;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function isCustomerInGracePeriod(dueDate: Date, gracePeriodDays: number, currentDate: Date = new Date()): boolean {
    const overdueDays = calculateOverdueDays(dueDate, currentDate);
    return overdueDays > 0 && overdueDays <= gracePeriodDays;
}

describe('Customer Credit Logic', () => {
    it('should allow order if within credit limit', () => {
        expect(canPlaceOrder(5000, 10000, 20000)).toBe(true);
    });

    it('should block order if exceeding credit limit', () => {
        expect(canPlaceOrder(15000, 10000, 20000)).toBe(false); // 25000 > 20000
    });

    it('should allow order if credit limit is 0 (unlimited)', () => {
        expect(canPlaceOrder(100000, 50000, 0)).toBe(true);
    });

    it('should calculate overdue days correctly', () => {
        const due = new Date('2026-06-01T00:00:00Z');
        const current = new Date('2026-06-05T00:00:00Z');
        expect(calculateOverdueDays(due, current)).toBe(4);
    });

    it('should return 0 overdue days if not yet due', () => {
        const due = new Date('2026-06-10T00:00:00Z');
        const current = new Date('2026-06-05T00:00:00Z');
        expect(calculateOverdueDays(due, current)).toBe(0);
    });

    it('should correctly identify grace period', () => {
        const due = new Date('2026-06-01T00:00:00Z');
        const currentInGrace = new Date('2026-06-04T00:00:00Z');
        const currentPastGrace = new Date('2026-06-08T00:00:00Z');

        expect(isCustomerInGracePeriod(due, 5, currentInGrace)).toBe(true); // 3 days overdue, grace 5
        expect(isCustomerInGracePeriod(due, 5, currentPastGrace)).toBe(false); // 7 days overdue, grace 5
    });
});
