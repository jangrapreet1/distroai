import { indianAmountToWords } from './amount-to-words';

describe('indianAmountToWords', () => {
    it('should return "Rupees Zero Only" for 0', () => {
        expect(indianAmountToWords(0)).toBe('Rupees Zero Only');
    });

    it('should handle 100', () => {
        expect(indianAmountToWords(100)).toBe('Rupees One Hundred Only');
    });

    it('should handle 1000', () => {
        expect(indianAmountToWords(1000)).toBe('Rupees One Thousand Only');
    });

    it('should handle 1,00,000 (one lakh)', () => {
        expect(indianAmountToWords(100000)).toBe('Rupees One Lakh Only');
    });

    it('should handle 1,00,00,000 (one crore)', () => {
        expect(indianAmountToWords(10000000)).toBe('Rupees One Crore Only');
    });

    it('should handle complex amount 1,23,456', () => {
        const result = indianAmountToWords(123456);
        expect(result).toBe('Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only');
    });

    it('should handle amount with paise: 1,23,456.50', () => {
        const result = indianAmountToWords(123456.50);
        expect(result).toBe('Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Paise Fifty Only');
    });

    it('should handle large amount: 1,23,45,678', () => {
        const result = indianAmountToWords(12345678);
        expect(result).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
    });

    it('should handle 12,34,56,78.50 (crores with paise)', () => {
        const result = indianAmountToWords(12345678.50);
        expect(result).toContain('Crore');
        expect(result).toContain('Paise Fifty');
    });
});
