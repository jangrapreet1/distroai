import { detectLanguage } from './language-detector';

describe('detectLanguage', () => {
    describe('Pure Hindi (Devanagari)', () => {
        it('should detect Hindi text written in Devanagari script', () => {
            expect(detectLanguage('आज की बिक्री कितनी हुई')).toBe('hi');
        });

        it('should detect short Hindi text', () => {
            expect(detectLanguage('स्टॉक बताओ')).toBe('hi');
        });
    });

    describe('Hinglish (romanized Hindi)', () => {
        it('should detect Hinglish with 2+ known words', () => {
            expect(detectLanguage('mujhe aaj ka stock batao')).toBe('hi');
        });

        it('should detect Hinglish with common words', () => {
            expect(detectLanguage('kitna payment aaya hai aaj')).toBe('hi');
        });

        it('should NOT detect Hinglish with only 1 known word', () => {
            expect(detectLanguage('show me aaj sales data')).toBe('en');
        });
    });

    describe('English', () => {
        it('should detect plain English business queries', () => {
            expect(detectLanguage('Show me top 5 customers by revenue')).toBe('en');
        });

        it('should detect English keywords', () => {
            expect(detectLanguage('What is the current inventory status?')).toBe('en');
        });

        it('should detect short English', () => {
            expect(detectLanguage('sales report')).toBe('en');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty string without crashing', () => {
            expect(detectLanguage('')).toBe('en');
        });

        it('should handle numbers only', () => {
            expect(detectLanguage('12345')).toBe('en');
        });

        it('should handle mixed Hindi + English', () => {
            // More than 10% Devanagari characters → Hindi
            expect(detectLanguage('मेरे top customers कौन हैं')).toBe('hi');
        });
    });
});
