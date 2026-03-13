// Unit tests for core business logic functions

import { calculatePaymentScore } from './payments/payments.service';

describe('calculatePaymentScore', () => {
    it('should return 100 for a perfect payer', () => {
        expect(calculatePaymentScore({ avgPaymentDelay: 0, partialPaymentRatio: 0, delayTrend: 0, outstandingRatio: 0 })).toBe(100);
    });

    it('should reduce score for delays', () => {
        const score = calculatePaymentScore({ avgPaymentDelay: 10, partialPaymentRatio: 0, delayTrend: 0, outstandingRatio: 0 });
        expect(score).toBe(80);
    });

    it('should never go below 0', () => {
        const score = calculatePaymentScore({ avgPaymentDelay: 100, partialPaymentRatio: 1, delayTrend: 100, outstandingRatio: 2 });
        expect(score).toBe(0);
    });
});

// GST calculation logic
function calculateGst(amount: number, gstRate: number, sameState: boolean) {
    const gstAmount = (amount * gstRate) / 100;
    return sameState
        ? { cgstAmount: gstAmount / 2, sgstAmount: gstAmount / 2, igstAmount: 0 }
        : { cgstAmount: 0, sgstAmount: 0, igstAmount: gstAmount };
}

describe('calculateGst', () => {
    it('should split GST as CGST+SGST for same state', () => {
        const result = calculateGst(1000, 18, true);
        expect(result.cgstAmount).toBe(90);
        expect(result.sgstAmount).toBe(90);
        expect(result.igstAmount).toBe(0);
    });

    it('should apply IGST for interstate', () => {
        const result = calculateGst(1000, 18, false);
        expect(result.cgstAmount).toBe(0);
        expect(result.sgstAmount).toBe(0);
        expect(result.igstAmount).toBe(180);
    });
});

// Order total calculation
function calculateOrderTotal(items: { price: number; quantity: number; discount?: number; gstRate: number }[]) {
    let totalAmount = 0, discountAmount = 0, taxAmount = 0;
    for (const item of items) {
        const lineTotal = item.price * item.quantity;
        const disc = item.discount ?? 0;
        const taxable = lineTotal - disc;
        const tax = (taxable * item.gstRate) / 100;
        totalAmount += lineTotal;
        discountAmount += disc;
        taxAmount += tax;
    }
    return { totalAmount, discountAmount, taxAmount, netAmount: totalAmount - discountAmount + taxAmount };
}

describe('calculateOrderTotal', () => {
    it('should calculate totals correctly', () => {
        const result = calculateOrderTotal([
            { price: 100, quantity: 2, discount: 10, gstRate: 18 },
        ]);
        expect(result.totalAmount).toBe(200);
        expect(result.discountAmount).toBe(10);
        expect(result.taxAmount).toBeCloseTo(34.2);
        expect(result.netAmount).toBeCloseTo(224.2);
    });
});

// Collection priority score formula
function calcCollectionPriority(daysOverdue: number, outstandingAmount: number, paymentScore: number): number {
    return daysOverdue * 0.4 + (outstandingAmount / 1000) * 0.3 + ((100 - paymentScore) * 0.3);
}

describe('calcCollectionPriority', () => {
    it('should prioritize high overdue + high outstanding + low score', () => {
        const high = calcCollectionPriority(60, 50000, 30);
        const low = calcCollectionPriority(5, 1000, 90);
        expect(high).toBeGreaterThan(low);
    });
});

// Invoice number generation
function generateInvoiceNumber(prefix: string, year: number, count: number): string {
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
}

describe('generateInvoiceNumber', () => {
    it('should format correctly', () => {
        expect(generateInvoiceNumber('INV', 2026, 99)).toBe('INV-2026-00100');
    });

    it('should pad to 5 digits', () => {
        expect(generateInvoiceNumber('INV', 2026, 0)).toBe('INV-2026-00001');
    });
});
