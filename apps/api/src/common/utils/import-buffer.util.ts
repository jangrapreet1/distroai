import * as XLSX from 'xlsx';

/**
 * Parses an HTML table into an Array of Arrays (AOA), separating multiple products
 * or multiline entries within a single cell with commas (', '), while ensuring that
 * all tables across the document are captured and thousands separators are preserved.
 */
export function htmlTableToAoa(html: string): string[][] {
    const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
    if (tableMatches.length === 0) return [];

    const allRows: string[][] = [];
    for (const tableHtml of tableMatches) {
        const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const tr of trMatches) {
            const row: string[] = [];
            const cellMatches = tr.match(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi) || [];
            for (const cell of cellMatches) {
                let text = cell
                    .replace(/<br\s*\/?>/gi, ', ')
                    .replace(/<\/p>/gi, ', ')
                    .replace(/<\/div>/gi, ', ')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/&amp;/gi, '&')
                    .replace(/&quot;/gi, '"')
                    .replace(/&#39;|&apos;/gi, "'")
                    .replace(/\s+/g, ' ')
                    .trim();
                // Collapse multiple consecutive commas e.g. ', ,' to ', '
                text = text.replace(/,\s*(?:,\s*)+/g, ', ');
                // Remove leading and trailing commas
                text = text.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                row.push(text);
            }
            if (row.length > 0 && row.some(c => c !== '')) {
                allRows.push(row);
            }
        }
    }
    return allRows;
}

function isDateLike(str: string): boolean {
    if (!str) return false;
    const s = str.trim();
    return /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(s);
}

/**
 * Robust TSV parser that intelligently handles:
 * 1. Standard RFC-4180 quoted multiline cells from Excel / Google Sheets
 * 2. Unquoted multiline cells copied directly from Google Docs / MS Word tables
 *    where cells with multiple lines/products emit raw newlines without quotes.
 */
export function parseTsvSmart(text: string): string[][] {
    const rawLines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(Boolean);
    if (rawLines.length === 0) return [];

    const rows: string[][] = [];
    let currentRow: string[] | null = null;
    let expectedCols = 0;

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const cols = line.split('\t').map(c => {
            let val = c.replace(/<br\s*\/?>/gi, ', ').trim();
            val = val.replace(/,\s*(?:,\s*)+/g, ', ');
            return val.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
        });

        if (i === 0) {
            expectedCols = cols.length;
            rows.push(cols);
            continue;
        }

        const startsWithDate = isDateLike(cols[0]);
        const lowerFirst = (cols[0] || '').toLowerCase();
        const isSummary = ['account summary', 'total', 'subtotal', 'balance', 'less:'].some(kw => lowerFirst.includes(kw));

        const hasFullCols = cols.length >= expectedCols || cols.length >= 4;
        const isCurrentComplete = currentRow && (
            currentRow.length >= expectedCols ||
            (currentRow.length >= 3 && (currentRow[2] || currentRow[3] || currentRow[4]))
        );

        if (startsWithDate || isSummary || !currentRow || hasFullCols || (isCurrentComplete && cols.length >= 2)) {
            if (currentRow) {
                rows.push(currentRow);
            }
            currentRow = [...cols];
        } else {
            // Continuation line of the previous row (e.g. multiline products in a single cell)
            const lastIdx = Math.max(0, currentRow.length - 1);
            if (cols.length === 1) {
                currentRow[lastIdx] = currentRow[lastIdx] ? `${currentRow[lastIdx]}, ${cols[0]}` : cols[0];
            } else {
                currentRow[lastIdx] = currentRow[lastIdx] ? `${currentRow[lastIdx]}, ${cols[0]}` : cols[0];
                for (let c = 1; c < cols.length; c++) {
                    currentRow.push(cols[c]);
                }
            }
        }
    }

    if (currentRow) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Universal buffer-to-workbook parser supporting:
 * 1. Microsoft Excel (.xlsx) & Binary Excel (.xls)
 * 2. Word documents (.docx) with embedded tables
 * 3. Copied/Pasted Tab-Separated Values (TSV) from Google Docs / Word / Excel
 * 4. Markdown pipe tables (| Col 1 | Col 2 |) from notes / docs / ChatGPT
 * 5. Comma-Separated Values (CSV) with full UTF-8 encoding
 */
export async function parseBufferToWorkbook(fileBuffer: Buffer): Promise<XLSX.WorkBook> {
    // 1. DOCX or XLSX (ZIP format starts with 'PK\x03\x04')
    if (fileBuffer.length > 4 && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b) {
        try {
            // Attempt DOCX conversion via mammoth
            const mammoth = await import('mammoth');
            const { value: html } = await mammoth.convertToHtml({ buffer: fileBuffer });
            if (html && html.includes('<table')) {
                const aoa = htmlTableToAoa(html);
                if (aoa.length > 0) {
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.aoa_to_sheet(aoa);
                    XLSX.utils.book_append_sheet(wb, ws, 'Imported');
                    return wb;
                }
            }
        } catch {
            // Fall through to standard XLSX
        }
        return XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, raw: true });
    }

    // 2. Binary XLS (OLE2 format)
    if (fileBuffer.length > 4 && fileBuffer[0] === 0xd0 && fileBuffer[1] === 0xcf) {
        return XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, raw: true });
    }

    // 3. Plain Text / Markdown / TSV / Copied from Google Docs or Word
    const text = fileBuffer.toString('utf-8');

    if (text.includes('<table') && text.includes('</table>')) {
        const aoa = htmlTableToAoa(text);
        if (aoa.length > 0) {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, 'Imported');
            return wb;
        }
    }

    if (text.includes('\t')) {
        const rows = parseTsvSmart(text);
        if (rows.length >= 2) {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Imported');
            return wb;
        }
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pipeLines = lines.filter(l => l.includes('|'));
    if (pipeLines.length >= 2) {
        // Markdown table format (e.g. from Google Docs, ChatGPT, text file)
        const rows: string[][] = [];
        for (const line of lines) {
            if (line.includes('|')) {
                // Skip markdown header separator lines e.g. |---|---|
                if (/^\|?(\s*:?-+:?\s*\|?)+$/.test(line)) continue;
                const cols = line.split('|').map(c => {
                    let text = c.replace(/<br\s*\/?>/gi, ', ').trim();
                    text = text.replace(/,\s*(?:,\s*)+/g, ', ');
                    return text.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                });
                if (line.startsWith('|') && cols.length > 0 && cols[0] === '') cols.shift();
                if (line.endsWith('|') && cols.length > 0 && cols[cols.length - 1] === '') cols.pop();
                rows.push(cols);
            }
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Imported');
        return wb;
    }

    // 4. Fallback to SheetJS string parser (handles CSV & HTML with full UTF-8 support)
    return XLSX.read(text, { type: 'string', cellDates: false, raw: true });
}
