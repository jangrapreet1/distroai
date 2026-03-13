/**
 * parseAIResponse — extracts <chart> and <table> XML tags from AI response text.
 * This is a standalone utility tested independently of the React component.
 */

interface ChartSpec { type: string; title: string; data: any[]; }
interface TableSpec { headers: string[]; rows: any[][]; }

function parseAIResponse(text: string): { cleanText: string; charts: ChartSpec[]; tables: TableSpec[] } {
    const chartRegex = /<chart type="(.*?)" title="(.*?)">(.*?)<\/chart>/gs;
    const tableRegex = /<table headers="(.*?)">(.*?)<\/table>/gs;

    const charts = [...text.matchAll(chartRegex)].map(match => ({
        type: match[1], title: match[2], data: JSON.parse(match[3])
    }));

    const tables = [...text.matchAll(tableRegex)].map(match => ({
        headers: match[1].split(','), rows: JSON.parse(match[2])
    }));

    const cleanText = text.replace(chartRegex, '').replace(tableRegex, '').trim();
    return { cleanText, charts, tables };
}

describe('parseAIResponse', () => {
    it('should return plain text with no charts or tables when no XML tags present', () => {
        const result = parseAIResponse('Revenue is growing at 12% month over month.');
        expect(result.cleanText).toBe('Revenue is growing at 12% month over month.');
        expect(result.charts).toHaveLength(0);
        expect(result.tables).toHaveLength(0);
    });

    it('should extract a single bar chart', () => {
        const input = 'Here is your sales data:\n<chart type="bar" title="Weekly Sales">[{"week":"W1","value":100},{"week":"W2","value":150}]</chart>\nLooks good!';
        const result = parseAIResponse(input);

        expect(result.charts).toHaveLength(1);
        expect(result.charts[0].type).toBe('bar');
        expect(result.charts[0].title).toBe('Weekly Sales');
        expect(result.charts[0].data).toEqual([
            { week: 'W1', value: 100 },
            { week: 'W2', value: 150 },
        ]);
        expect(result.cleanText).toBe('Here is your sales data:\n\nLooks good!');
    });

    it('should extract a single table', () => {
        const input = 'Top customers:\n<table headers="Name,Revenue,Orders">[["Sharma Store",50000,25],["Gupta Traders",42000,18]]</table>';
        const result = parseAIResponse(input);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].headers).toEqual(['Name', 'Revenue', 'Orders']);
        expect(result.tables[0].rows).toEqual([
            ['Sharma Store', 50000, 25],
            ['Gupta Traders', 42000, 18],
        ]);
        expect(result.cleanText).toBe('Top customers:');
    });

    it('should extract multiple charts and tables', () => {
        const input = 'Analysis:\n<chart type="line" title="Trend">[{"d":"Jan","v":10}]</chart>\n<table headers="Product,Stock">[["Maggi",500]]</table>\nSummary here.';
        const result = parseAIResponse(input);

        expect(result.charts).toHaveLength(1);
        expect(result.tables).toHaveLength(1);
        expect(result.charts[0].type).toBe('line');
        expect(result.tables[0].headers).toEqual(['Product', 'Stock']);
        expect(result.cleanText).toContain('Analysis:');
        expect(result.cleanText).toContain('Summary here.');
    });

    it('should handle pie chart type', () => {
        const input = '<chart type="pie" title="Category Split">[{"name":"FMCG","value":60},{"name":"Pharma","value":40}]</chart>';
        const result = parseAIResponse(input);

        expect(result.charts).toHaveLength(1);
        expect(result.charts[0].type).toBe('pie');
        expect(result.charts[0].data).toHaveLength(2);
    });

    it('should handle empty text', () => {
        const result = parseAIResponse('');
        expect(result.cleanText).toBe('');
        expect(result.charts).toHaveLength(0);
        expect(result.tables).toHaveLength(0);
    });
});
