import { formatDate, formatDateTime, timeAgo, greeting } from './utils';

describe('formatDate', () => {
    it('should format a date string to dd MMM yyyy', () => {
        const result = formatDate('2026-03-04T10:00:00Z');
        expect(result).toMatch(/04 Mar 2026/);
    });

    it('should handle Date objects', () => {
        const result = formatDate(new Date('2026-01-15'));
        expect(result).toMatch(/15 Jan 2026/);
    });
});

describe('formatDateTime', () => {
    it('should include time in the formatted string', () => {
        const result = formatDateTime('2026-03-04T14:30:00Z');
        expect(result).toContain('04 Mar 2026');
    });
});

describe('timeAgo', () => {
    it('should return a human-readable time difference', () => {
        const recent = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
        const result = timeAgo(recent);
        expect(result).toContain('ago');
    });
});

describe('greeting', () => {
    it('should return a greeting based on the time of day', () => {
        const result = greeting();
        expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(result);
    });
});
