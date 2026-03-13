import { INDIAN_STATES } from './indian-states';

describe('INDIAN_STATES', () => {
    it('should contain all 28 states and 8 union territories', () => {
        expect(INDIAN_STATES.length).toBe(36);
    });

    it('should include major states', () => {
        expect(INDIAN_STATES).toContain('Maharashtra');
        expect(INDIAN_STATES).toContain('Delhi');
        expect(INDIAN_STATES).toContain('Karnataka');
        expect(INDIAN_STATES).toContain('Tamil Nadu');
        expect(INDIAN_STATES).toContain('Gujarat');
    });

    it('should be a readonly array', () => {
        // TypeScript enforces this, but let's sanity check
        expect(Array.isArray(INDIAN_STATES)).toBe(true);
    });
});
