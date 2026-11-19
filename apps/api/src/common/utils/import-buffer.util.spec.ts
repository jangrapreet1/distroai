import { parseBufferToWorkbook } from './import-buffer.util';
import * as XLSX from 'xlsx';

describe('import-buffer.util - parseBufferToWorkbook', () => {
    it('should parse Markdown pipe table into a valid workbook', async () => {
        const md = `
| DATE   | GOODS GIVEN | AMOUNT | RETURNED | PAYMENT RECEIVED |
| 04/08/26 | 4 Packet Leveler | ₹22,098 | | |
| 10/08/26 | 13 Box 2x4 | ₹10,814 | | |
`;
        const buf = Buffer.from(md, 'utf-8');
        const wb = await parseBufferToWorkbook(buf);
        expect(wb).toBeDefined();
        expect(wb.SheetNames.length).toBeGreaterThan(0);

        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        expect(rows.length).toBe(3);
        expect(rows[0]).toEqual(['DATE', 'GOODS GIVEN', 'AMOUNT', 'RETURNED', 'PAYMENT RECEIVED']);
        expect(rows[1][0]).toBe('04/08/26');
        expect(rows[1][2]).toBe('₹22,098');
    });

    it('should parse Tab-Separated Values (TSV) from Google Docs/Word into a valid workbook', async () => {
        const tsv = `DATE\tGOODS GIVEN\tAMOUNT\tRETURNED\tPAYMENT RECEIVED\n04/08/26\tLeveler\t₹22,098\t\t\n10/08/26\tBox 2x4\t₹10,814\t\t`;
        const buf = Buffer.from(tsv, 'utf-8');
        const wb = await parseBufferToWorkbook(buf);

        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        expect(rows.length).toBe(3);
        expect(rows[0][0]).toBe('DATE');
        expect(rows[1][1]).toBe('Leveler');
        expect(rows[2][2]).toBe('₹10,814');
    });

    it('should parse standard CSV text buffer into a valid workbook', async () => {
        const csv = `Date,Item,Amount\n2026-08-04,Cement,22098\n2026-08-10,Adhesive,10814`;
        const buf = Buffer.from(csv, 'utf-8');
        const wb = await parseBufferToWorkbook(buf);

        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        expect(rows.length).toBe(3);
        expect(rows[0]).toEqual(['Date', 'Item', 'Amount']);
        expect(rows[1]).toEqual(['2026-08-04', 'Cement', '22098']);
    });

    it('should parse standard Excel binary (.xlsx) buffer into a valid workbook', async () => {
        const sourceWb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Date', 'Item', 'Amount'],
            ['2026-08-04', 'Test Item', 5000],
        ]);
        XLSX.utils.book_append_sheet(sourceWb, ws, 'Sheet1');
        const xlsxBuf = XLSX.write(sourceWb, { type: 'buffer', bookType: 'xlsx' });

        const wb = await parseBufferToWorkbook(xlsxBuf);
        expect(wb.SheetNames).toContain('Sheet1');
        const parsedWs = wb.Sheets['Sheet1'];
        const rows: any[][] = XLSX.utils.sheet_to_json(parsedWs, { header: 1 });
        expect(rows.length).toBe(2);
        expect(rows[1][1]).toBe('Test Item');
    });

    it('should insert commas between multiple products in the same cell in an HTML/Word table without corrupting numbers', async () => {
        const html = `
        <table>
            <tr><th>DATE</th><th>GOODS GIVEN</th><th>AMOUNT</th></tr>
            <tr>
                <td>10/09/26</td>
                <td>
                    <p>1 12×12 Manhole cover — ₹600<br />60 ft golden brush — ₹1,200<br />8 Bag Type-3 — 600 × 8 = ₹4,800</p>
                </td>
                <td><p>₹6,600</p></td>
            </tr>
        </table>`;
        const buf = Buffer.from(html, 'utf-8');
        const wb = await parseBufferToWorkbook(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        expect(rows.length).toBe(2);
        expect(rows[1][1]).toBe(
            '1 12×12 Manhole cover — ₹600, 60 ft golden brush — ₹1,200, 8 Bag Type-3 — 600 × 8 = ₹4,800'
        );
    });

    it('should parse and combine rows from multiple tables across a document', async () => {
        const html = `
        <table>
            <tr><th>DATE</th><th>GOODS GIVEN</th><th>AMOUNT</th></tr>
            <tr><td>04/08/26</td><td>Item 1</td><td>1000</td></tr>
        </table>
        <p>Some text</p>
        <table>
            <tr><td>05/08/26</td><td>Item 2</td><td>2000</td></tr>
        </table>`;
        const buf = Buffer.from(html, 'utf-8');
        const wb = await parseBufferToWorkbook(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        expect(rows.length).toBe(3);
        expect(rows[1][1]).toBe('Item 1');
        expect(rows[2][1]).toBe('Item 2');
    });
});
