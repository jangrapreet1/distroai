import { GstUtility, STATE_CODES } from './gst.util';

describe('GstUtility', () => {
    describe('parse()', () => {
        it('should parse a valid Maharashtra GSTIN', () => {
            const result = GstUtility.parse('27AABCU9603R1ZM');
            expect(result.valid).toBe(true);
            expect(result.stateCode).toBe('27');
            expect(result.stateName).toBe('Maharashtra');
            expect(result.pan).toBe('AABCU9603R');
        });

        it('should parse a valid Gujarat GSTIN', () => {
            const result = GstUtility.parse('24AAACC4175D1ZC');
            expect(result.valid).toBe(true);
            expect(result.stateCode).toBe('24');
            expect(result.stateName).toBe('Gujarat');
            expect(result.pan).toBe('AAACC4175D');
        });

        it('should parse a valid Delhi GSTIN', () => {
            const result = GstUtility.parse('07AAACH7409R1ZZ');
            expect(result.valid).toBe(true);
            expect(result.stateName).toBe('Delhi');
        });

        it('should reject a GSTIN shorter than 15 characters', () => {
            expect(GstUtility.parse('27AABCU').valid).toBe(false);
        });

        it('should reject a GSTIN longer than 15 characters', () => {
            expect(GstUtility.parse('27AABCU9603R1ZMXXX').valid).toBe(false);
        });

        it('should reject null/undefined/empty', () => {
            expect(GstUtility.parse('').valid).toBe(false);
            expect(GstUtility.parse(null as any).valid).toBe(false);
            expect(GstUtility.parse(undefined as any).valid).toBe(false);
        });

        it('should reject a GSTIN with an invalid state code', () => {
            const result = GstUtility.parse('99AABCU9603R1ZM');
            expect(result.valid).toBe(false);
        });
    });

    describe('calculateTaxes() — Intra-State (CGST + SGST)', () => {
        it('should split GST 50/50 into CGST and SGST for same-state GSTIN', () => {
            // Both Maharashtra (27)
            const taxes = GstUtility.calculateTaxes(
                '27AABCU9603R1ZM', // seller
                '27ZZZZZ9999Z1ZZ', // buyer
                10000,
                18
            );
            expect(taxes.cgstAmount).toBe(900);
            expect(taxes.sgstAmount).toBe(900);
            expect(taxes.igstAmount).toBe(0);
            expect(taxes.totalTaxAmount).toBe(1800);
        });

        it('should split GST using state names if both are strings', () => {
            const taxes = GstUtility.calculateTaxes('Maharashtra', 'maharashtra', 5000, 12);
            expect(taxes.cgstAmount).toBe(300);
            expect(taxes.sgstAmount).toBe(300);
            expect(taxes.igstAmount).toBe(0);
        });

        it('should default to intra-state when buyer is null (B2C)', () => {
            const taxes = GstUtility.calculateTaxes('27AABCU9603R1ZM', null, 10000, 18);
            expect(taxes.cgstAmount).toBe(900);
            expect(taxes.sgstAmount).toBe(900);
            expect(taxes.igstAmount).toBe(0);
        });

        it('should default to intra-state when both are null', () => {
            const taxes = GstUtility.calculateTaxes(null, null, 2000, 5);
            expect(taxes.cgstAmount).toBe(50);
            expect(taxes.sgstAmount).toBe(50);
            expect(taxes.igstAmount).toBe(0);
            expect(taxes.totalTaxAmount).toBe(100);
        });
    });

    describe('calculateTaxes() — Inter-State (IGST)', () => {
        it('should apply full GST as IGST for different-state GSTINs', () => {
            // Seller Maharashtra (27), Buyer Gujarat (24)
            const taxes = GstUtility.calculateTaxes(
                '27AABCU9603R1ZM',
                '24AAACC4175D1ZC',
                10000,
                18
            );
            expect(taxes.cgstAmount).toBe(0);
            expect(taxes.sgstAmount).toBe(0);
            expect(taxes.igstAmount).toBe(1800);
            expect(taxes.totalTaxAmount).toBe(1800);
        });

        it('should apply IGST for different state name strings', () => {
            const taxes = GstUtility.calculateTaxes('Maharashtra', 'Gujarat', 8000, 12);
            expect(taxes.cgstAmount).toBe(0);
            expect(taxes.sgstAmount).toBe(0);
            expect(taxes.igstAmount).toBe(960);
        });
    });

    describe('calculateTaxes() — CESS', () => {
        it('should calculate CESS independently from GST', () => {
            const taxes = GstUtility.calculateTaxes(
                '27AABCU9603R1ZM',
                '27ZZZZZ9999Z1ZZ',
                10000,
                28,
                12  // 12% Cess
            );
            expect(taxes.cgstAmount).toBe(1400);
            expect(taxes.sgstAmount).toBe(1400);
            expect(taxes.igstAmount).toBe(0);
            expect(taxes.cessAmount).toBe(1200);
            expect(taxes.totalTaxAmount).toBe(4000); // 2800 GST + 1200 Cess
        });

        it('should add CESS on top of IGST for inter-state', () => {
            const taxes = GstUtility.calculateTaxes(
                '27AABCU9603R1ZM',
                '24AAACC4175D1ZC',
                10000,
                28,
                12
            );
            expect(taxes.igstAmount).toBe(2800);
            expect(taxes.cessAmount).toBe(1200);
            expect(taxes.totalTaxAmount).toBe(4000);
        });

        it('should handle 0% cess gracefully', () => {
            const taxes = GstUtility.calculateTaxes('Maharashtra', 'Maharashtra', 5000, 18, 0);
            expect(taxes.cessAmount).toBe(0);
        });
    });

    describe('calculateTaxes() — Edge Cases', () => {
        it('should return zero taxes for 0% GST rate', () => {
            const taxes = GstUtility.calculateTaxes('Maharashtra', 'Maharashtra', 10000, 0);
            expect(taxes.cgstAmount).toBe(0);
            expect(taxes.sgstAmount).toBe(0);
            expect(taxes.igstAmount).toBe(0);
            expect(taxes.totalTaxAmount).toBe(0);
        });

        it('should handle fractional amounts with 2 decimal precision', () => {
            const taxes = GstUtility.calculateTaxes('Maharashtra', 'Maharashtra', 999, 18);
            // 999 * 18/100 = 179.82 total, split is 89.91 each
            expect(taxes.cgstAmount).toBe(89.91);
            expect(taxes.sgstAmount).toBe(89.91);
            expect(taxes.totalTaxAmount).toBe(179.82);
        });

        it('should preserve taxableValue in the return', () => {
            const taxes = GstUtility.calculateTaxes('Maharashtra', 'Maharashtra', 12345, 5);
            expect(taxes.taxableValue).toBe(12345);
        });
    });

    describe('STATE_CODES', () => {
        it('should have 27 as Maharashtra', () => {
            expect(STATE_CODES['27']).toBe('Maharashtra');
        });

        it('should have 07 as Delhi', () => {
            expect(STATE_CODES['07']).toBe('Delhi');
        });

        it('should not have 00 or 99', () => {
            expect(STATE_CODES['00']).toBeUndefined();
            expect(STATE_CODES['99']).toBeUndefined();
        });
    });
});
