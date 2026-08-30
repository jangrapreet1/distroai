/**
 * Unit tests for Payment Allocation Logic.
 */

interface InvoiceBalance {
    id: string;
    balanceAmount: number;
}

/**
 * Allocates a single payment amount across multiple outstanding invoices (FIFO).
 */
function allocatePayment(paymentAmount: number, invoices: InvoiceBalance[]) {
    let remainingPayment = paymentAmount;
    const allocations: { invoiceId: string; amountAllocated: number; newBalance: number }[] = [];

    // Sort invoices implicitly assumed to be oldest first in this array
    for (const inv of invoices) {
        if (remainingPayment <= 0) break;
        if (inv.balanceAmount <= 0) continue;

        const amountToAllocate = Math.min(inv.balanceAmount, remainingPayment);
        allocations.push({
            invoiceId: inv.id,
            amountAllocated: amountToAllocate,
            newBalance: inv.balanceAmount - amountToAllocate
        });

        remainingPayment -= amountToAllocate;
    }

    return { allocations, remainingPayment }; // remainingPayment is unallocated advance
}

describe('Payment Allocation Logic (FIFO)', () => {
    it('should fully pay one invoice and partially pay the next', () => {
        const invoices = [
            { id: 'INV-1', balanceAmount: 5000 },
            { id: 'INV-2', balanceAmount: 7000 }
        ];

        const { allocations, remainingPayment } = allocatePayment(8000, invoices);

        expect(remainingPayment).toBe(0);
        expect(allocations).toHaveLength(2);
        
        expect(allocations[0].invoiceId).toBe('INV-1');
        expect(allocations[0].amountAllocated).toBe(5000);
        expect(allocations[0].newBalance).toBe(0);

        expect(allocations[1].invoiceId).toBe('INV-2');
        expect(allocations[1].amountAllocated).toBe(3000);
        expect(allocations[1].newBalance).toBe(4000);
    });

    it('should leave unallocated payment if amount exceeds all invoice balances', () => {
        const invoices = [
            { id: 'INV-1', balanceAmount: 1000 }
        ];

        const { allocations, remainingPayment } = allocatePayment(1500, invoices);

        expect(allocations[0].amountAllocated).toBe(1000);
        expect(allocations[0].newBalance).toBe(0);
        expect(remainingPayment).toBe(500); // Advance payment
    });

    it('should handle zero payment amount', () => {
        const invoices = [
            { id: 'INV-1', balanceAmount: 1000 }
        ];

        const { allocations, remainingPayment } = allocatePayment(0, invoices);
        expect(allocations).toHaveLength(0);
        expect(remainingPayment).toBe(0);
    });
});
