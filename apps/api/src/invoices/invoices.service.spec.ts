/**
 * Unit tests for Invoice business logic — GST calculations and statuses.
 */

interface InvoiceLineItem {
    price: number;
    quantity: number;
    taxRate: number;
}

function calculateInvoiceTotals(items: InvoiceLineItem[], isInterState: boolean) {
    let totalTaxable = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    for (const item of items) {
        const taxable = item.price * item.quantity;
        totalTaxable += taxable;

        if (isInterState) {
            igstAmount += taxable * (item.taxRate / 100);
        } else {
            cgstAmount += taxable * ((item.taxRate / 2) / 100);
            sgstAmount += taxable * ((item.taxRate / 2) / 100);
        }
    }

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const netAmount = totalTaxable + totalTax;

    return { totalTaxable, cgstAmount, sgstAmount, igstAmount, totalTax, netAmount };
}

describe('Invoice GST Calculations', () => {
    it('should calculate CGST and SGST correctly for intra-state (local) sales', () => {
        const result = calculateInvoiceTotals([
            { price: 1000, quantity: 2, taxRate: 18 } // 2000 taxable
        ], false);

        expect(result.totalTaxable).toBe(2000);
        expect(result.cgstAmount).toBe(180); // 9%
        expect(result.sgstAmount).toBe(180); // 9%
        expect(result.igstAmount).toBe(0);
        expect(result.totalTax).toBe(360);
        expect(result.netAmount).toBe(2360);
    });

    it('should calculate IGST correctly for inter-state sales', () => {
        const result = calculateInvoiceTotals([
            { price: 1000, quantity: 2, taxRate: 18 } // 2000 taxable
        ], true);

        expect(result.totalTaxable).toBe(2000);
        expect(result.cgstAmount).toBe(0);
        expect(result.sgstAmount).toBe(0);
        expect(result.igstAmount).toBe(360); // 18%
        expect(result.totalTax).toBe(360);
        expect(result.netAmount).toBe(2360);
    });

    it('should handle zero tax rate products', () => {
        const result = calculateInvoiceTotals([
            { price: 500, quantity: 10, taxRate: 0 }
        ], false);

        expect(result.totalTax).toBe(0);
        expect(result.netAmount).toBe(5000);
    });
});
