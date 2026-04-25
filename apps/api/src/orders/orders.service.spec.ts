/**
 * Unit tests for order business logic — total calculations, status transitions.
 */

// ── Order total calculation (mirrors the core computation) ──────

interface OrderLineItem {
    price: number;
    quantity: number;
    discount: number;
    taxRate: number;
}

function calculateOrderTotals(items: OrderLineItem[]) {
    let totalAmount = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    for (const item of items) {
        const lineTotal = item.price * item.quantity;
        const taxable = lineTotal - item.discount;
        const tax = (taxable * item.taxRate) / 100;
        totalAmount += lineTotal;
        discountAmount += item.discount;
        taxAmount += tax;
    }

    const netAmount = totalAmount - discountAmount + taxAmount;
    return { totalAmount, discountAmount, taxAmount, netAmount };
}

// ── Order status machine ───────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PACKED', 'CANCELLED'],
    PACKED: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: [],
};

function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function calculateBalance(netAmount: number, paidAmount: number) {
    return Math.max(0, netAmount - paidAmount);
}

// ── Tests ──────────────────────────────────────────────────────

describe('Order Total Calculations', () => {
    it('should calculate single item total correctly', () => {
        const result = calculateOrderTotals([
            { price: 500, quantity: 10, discount: 200, taxRate: 18 },
        ]);
        expect(result.totalAmount).toBe(5000);
        expect(result.discountAmount).toBe(200);
        expect(result.taxAmount).toBeCloseTo(864);
        expect(result.netAmount).toBeCloseTo(5664);
    });

    it('should handle multiple items', () => {
        const result = calculateOrderTotals([
            { price: 100, quantity: 5, discount: 0, taxRate: 5 },
            { price: 200, quantity: 3, discount: 50, taxRate: 12 },
        ]);
        expect(result.totalAmount).toBe(1100);
        expect(result.discountAmount).toBe(50);
        expect(result.taxAmount).toBeCloseTo(91);
        expect(result.netAmount).toBeCloseTo(1141);
    });

    it('should handle zero discount and zero tax', () => {
        const result = calculateOrderTotals([
            { price: 250, quantity: 4, discount: 0, taxRate: 0 },
        ]);
        expect(result.totalAmount).toBe(1000);
        expect(result.discountAmount).toBe(0);
        expect(result.taxAmount).toBe(0);
        expect(result.netAmount).toBe(1000);
    });

    it('should handle empty items array', () => {
        const result = calculateOrderTotals([]);
        expect(result.netAmount).toBe(0);
    });
});

describe('Order Status Transitions', () => {
    it('should allow DRAFT → CONFIRMED', () => {
        expect(canTransition('DRAFT', 'CONFIRMED')).toBe(true);
    });

    it('should allow DRAFT → CANCELLED', () => {
        expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    });

    it('should NOT allow DRAFT → DELIVERED', () => {
        expect(canTransition('DRAFT', 'DELIVERED')).toBe(false);
    });

    it('should allow DELIVERED → RETURNED', () => {
        expect(canTransition('DELIVERED', 'RETURNED')).toBe(true);
    });

    it('should NOT allow CANCELLED → anything', () => {
        expect(canTransition('CANCELLED', 'DRAFT')).toBe(false);
        expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    });

    it('should follow the full happy path', () => {
        const path = ['DRAFT', 'CONFIRMED', 'PACKED', 'DISPATCHED', 'DELIVERED'];
        for (let i = 0; i < path.length - 1; i++) {
            expect(canTransition(path[i], path[i + 1])).toBe(true);
        }
    });
});

describe('Order Balance Calculation', () => {
    it('should calculate remaining balance', () => {
        expect(calculateBalance(5000, 2000)).toBe(3000);
    });

    it('should return 0 for fully paid orders', () => {
        expect(calculateBalance(5000, 5000)).toBe(0);
    });

    it('should return 0 for overpaid orders (no negative balance)', () => {
        expect(calculateBalance(5000, 6000)).toBe(0);
    });
});
