import { invoiceToTallyXML, paymentToTallyXML } from './tally-xml';

describe('invoiceToTallyXML', () => {
    const sampleInvoice = {
        invoiceNumber: 'INV-2025-00001',
        invoiceDate: new Date('2025-03-01'),
        netAmount: 11800,
        taxAmount: 1800,
        totalAmount: 10000,
        customer: { name: 'Rajesh Kirana Store', gstin: '27AABCR1234F1Z5' },
        org: { name: 'Test Distributor' },
        items: [{
            product: { name: 'Parle-G 800g', hsnCode: '19053100' },
            quantity: 100,
            price: 100,
            totalAmount: 11800,
            cgstAmount: 900,
            sgstAmount: 900,
            igstAmount: 0,
            gstRate: 18,
        }],
    };

    it('should generate valid XML envelope', () => {
        const xml = invoiceToTallyXML(sampleInvoice);
        expect(xml).toContain('<ENVELOPE>');
        expect(xml).toContain('</ENVELOPE>');
    });

    it('should contain the invoice number', () => {
        const xml = invoiceToTallyXML(sampleInvoice);
        expect(xml).toContain('INV-2025-00001');
    });

    it('should contain the customer name', () => {
        const xml = invoiceToTallyXML(sampleInvoice);
        expect(xml).toContain('Rajesh Kirana Store');
    });

    it('should have Sales voucher type', () => {
        const xml = invoiceToTallyXML(sampleInvoice);
        expect(xml).toContain('VCHTYPE="Sales"');
    });

    it('should include CGST and SGST entries for intra-state', () => {
        const xml = invoiceToTallyXML(sampleInvoice);
        expect(xml).toContain('<LEDGERNAME>CGST</LEDGERNAME>');
        expect(xml).toContain('<LEDGERNAME>SGST</LEDGERNAME>');
    });

    it('should include IGST entry for inter-state', () => {
        const interStateInvoice = {
            ...sampleInvoice,
            items: [{ ...sampleInvoice.items[0], cgstAmount: 0, sgstAmount: 0, igstAmount: 1800 }],
        };
        const xml = invoiceToTallyXML(interStateInvoice);
        expect(xml).toContain('<LEDGERNAME>IGST</LEDGERNAME>');
    });

    it('should include stock items', () => {
        const xml = invoiceToTallyXML(sampleInvoice);
        expect(xml).toContain('Parle-G 800g');
        expect(xml).toContain('ALLINVENTORYENTRIES.LIST');
    });

    it('should escape XML special characters', () => {
        const invoiceWithSpecialChars = {
            ...sampleInvoice,
            customer: { name: 'R&K Store <test>', gstin: null },
        };
        const xml = invoiceToTallyXML(invoiceWithSpecialChars);
        expect(xml).toContain('R&amp;K Store &lt;test&gt;');
    });
});

describe('paymentToTallyXML', () => {
    const samplePayment = {
        paymentNumber: 'PAY-001',
        paymentDate: new Date('2025-03-05'),
        amount: 5000,
        paymentMethod: 'BANK_TRANSFER',
        customer: { name: 'Rajesh Kirana Store' },
        org: { name: 'Test Distributor' },
    };

    it('should generate valid XML envelope', () => {
        const xml = paymentToTallyXML(samplePayment);
        expect(xml).toContain('<ENVELOPE>');
        expect(xml).toContain('</ENVELOPE>');
    });

    it('should have Receipt voucher type', () => {
        const xml = paymentToTallyXML(samplePayment);
        expect(xml).toContain('VCHTYPE="Receipt"');
    });

    it('should use Bank Account for non-cash payments', () => {
        const xml = paymentToTallyXML(samplePayment);
        expect(xml).toContain('Bank Account');
    });

    it('should use Cash for cash payments', () => {
        const xml = paymentToTallyXML({ ...samplePayment, paymentMethod: 'CASH' });
        expect(xml).toContain('<LEDGERNAME>Cash</LEDGERNAME>');
    });
});
