import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerLedgerCalculationEngine, CustomerTransactionType, round2, toDateOnlyString } from './customer-transactions.calculation';
import { RedisService } from '../common/services/redis.service';
import { parseBufferToWorkbook } from '../common/utils/import-buffer.util';

export interface KhataImportRow {
    date: string;
    description?: string;
    saleAmount?: number;
    returnedAmount?: number;
    paymentReceivedAmount?: number;
    reference?: string;
    notes?: string;
}

export interface KhataValidationResult {
    rowIndex: number;
    data: KhataImportRow;
    isValid: boolean;
    txType: 'SALE' | 'RETURN' | 'PAYMENT' | 'MIXED' | 'INVALID';
    effectiveAmount: number;
    projectedRunningBalance: number;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
}

const KHATA_HEADER_SYNONYMS: Record<keyof KhataImportRow, string[]> = {
    date: ['date', 'transaction date', 'tx date', 'entry date', 'dt', 'bill date', 'invoice date'],
    description: ['goods given', 'goods given to sunny', 'goods given to customer', 'particulars', 'description', 'items', 'item details', 'details', 'item', 'narration', 'product'],
    saleAmount: ['amount', 'sale amount', 'sale', 'goods given amount', 'debit', 'dr', 'dr amount', 'bill amount', 'invoice amount'],
    returnedAmount: ['returned', 'return', 'return amount', 'goods returned', 'credit note', 'cr note', 'sales return'],
    paymentReceivedAmount: ['payment received', 'payment', 'paid', 'credit', 'cr', 'amount received', 'received', 'cash/upi/bank', 'payment amt'],
    reference: ['reference', 'ref', 'bill no', 'invoice no', 'receipt no', 'voucher no', 'doc no', 'chq no'],
    notes: ['notes', 'remarks', 'comment'],
};

@Injectable()
export class CustomerTransactionsImportService {
    private readonly logger = new Logger(CustomerTransactionsImportService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis?: RedisService,
    ) { }

    private normalizeHeader(header: string): string {
        return header.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    private parseDate(val: any): string | null {
        if (!val) return null;
        if (val instanceof Date && !isNaN(val.getTime())) {
            return toDateOnlyString(val);
        }
        // Excel serial date number
        if (typeof val === 'number') {
            const parsed = XLSX.SSF.parse_date_code(val);
            if (parsed) {
                const mm = String(parsed.m).padStart(2, '0');
                const dd = String(parsed.d).padStart(2, '0');
                return `${parsed.y}-${mm}-${dd}`;
            }
        }
        const s = String(val).trim();
        // Check YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

        // Check DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
        const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
        if (dmy) {
            const dd = dmy[1].padStart(2, '0');
            const mm = dmy[2].padStart(2, '0');
            let yyyy = dmy[3];
            if (yyyy.length === 2) {
                yyyy = Number(yyyy) > 50 ? `19${yyyy}` : `20${yyyy}`;
            }
            return `${yyyy}-${mm}-${dd}`;
        }

        // Try standard Date.parse
        const timestamp = Date.parse(s);
        if (!isNaN(timestamp)) {
            return toDateOnlyString(new Date(timestamp));
        }

        return null;
    }

    private isSummaryOrFooterRow(rowValues: any[]): boolean {
        const combined = rowValues.map(v => String(v || '').toLowerCase().trim()).join(' ');
        if (!combined) return false;

        const summaryKeywords = [
            'account summary',
            'total goods',
            'total purchase',
            'total amount',
            'grand total',
            'less: goods',
            'less: payment',
            'less: return',
            'net balance',
            'closing balance',
        ];

        if (summaryKeywords.some(kw => combined.includes(kw))) {
            return true;
        }

        const firstNonEmpty = rowValues.map(v => String(v || '').toLowerCase().trim()).find(Boolean) || '';
        if (['total', 'subtotal', 'sub-total', 'balance', 'closing balance'].includes(firstNonEmpty)) {
            return true;
        }

        return false;
    }

    private parseAmount(val: any): number {
        if (val === undefined || val === '' || val === null) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : round2(Math.abs(val));

        const s = String(val).trim();
        if (!s || s === '-' || s === '--' || s === 'N/A' || s === 'nil') return 0;

        // Split on whitespace, newlines, '+', '&', ';', '/', '|'
        const tokens = s.split(/[\s+\n\r\t;&/|]+/);
        let total = 0;
        for (const t of tokens) {
            if (!t) continue;
            const cleaned = t.replace(/[^0-9.-]/g, '');
            if (cleaned && cleaned !== '.' && cleaned !== '-') {
                const n = Number(cleaned);
                if (!isNaN(n)) {
                    total += Math.abs(n);
                }
            }
        }
        return round2(total);
    }

    private detectColumnMapping(headers: string[]): Record<keyof KhataImportRow, string | null> {
        const mapping: Record<keyof KhataImportRow, string | null> = {
            date: null,
            description: null,
            saleAmount: null,
            returnedAmount: null,
            paymentReceivedAmount: null,
            reference: null,
            notes: null,
        };

        const normalizedHeaders = headers.map(h => ({ original: h, norm: this.normalizeHeader(h) }));

        for (const [field, synonyms] of Object.entries(KHATA_HEADER_SYNONYMS)) {
            for (const h of normalizedHeaders) {
                // exact match or starts with synonym (e.g. "goods given to sunny" starts with "goods given")
                if (synonyms.includes(h.norm) || synonyms.some(syn => h.norm.startsWith(syn))) {
                    mapping[field as keyof KhataImportRow] = h.original;
                    break;
                }
            }
        }

        return mapping;
    }

    /**
     * Preview Khata spreadsheet for a specific customer.
     */
    async previewCustomerKhata(orgId: string, customerId: string, fileBuffer: Buffer) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, orgId },
            select: { id: true, name: true, phone: true, outstandingAmount: true },
        });

        if (!customer) {
            throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
        }

        let wb: XLSX.WorkBook;
        try {
            wb = await parseBufferToWorkbook(fileBuffer);
        } catch {
            throw new BadRequestException({ code: 'INVALID_FILE', message: 'Unable to parse file. Please upload a valid .xlsx, .xls, .csv, .docx, or .txt file.' });
        }

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new BadRequestException({ code: 'EMPTY_WORKBOOK', message: 'The uploaded file contains no sheets.' });
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rawJson.length < 2) {
            throw new BadRequestException({ code: 'NO_DATA', message: 'The sheet contains no transaction rows.' });
        }

        // Header detection
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
            const rowStr = rawJson[i].map((c: any) => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('date') || rowStr.includes('goods') || rowStr.includes('amount') || rowStr.includes('payment') || rowStr.includes('returned')) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = (rawJson[headerRowIndex] || []).map((h: any) => String(h).trim()).filter(Boolean);
        const dataRows = rawJson.slice(headerRowIndex + 1);
        const mapping = this.detectColumnMapping(headers);

        const validationResults: KhataValidationResult[] = [];
        let currentRunningBalance = Number(customer.outstandingAmount || 0);
        let lastValidDate: string | null = null;

        for (let idx = 0; idx < dataRows.length; idx++) {
            const rawRow = dataRows[idx];
            if (!rawRow || rawRow.every((val: any) => val === '' || val === null || val === undefined)) {
                continue;
            }

            // Skip trailing account summary and footer total rows (e.g. "ACCOUNT SUMMARY", "TOTAL GOODS GIVEN", "BALANCE")
            if (this.isSummaryOrFooterRow(rawRow)) {
                continue;
            }

            const getVal = (field: keyof KhataImportRow): any => {
                const headerName = mapping[field];
                if (!headerName) return undefined;
                const colIdx = headers.indexOf(headerName);
                if (colIdx === -1) return undefined;
                return rawRow[colIdx];
            };

            const errors: { field: string; message: string }[] = [];
            const warnings: { field: string; message: string }[] = [];

            // 1. Date
            const rawDate = getVal('date');
            let parsedDate = this.parseDate(rawDate);
            if (!parsedDate) {
                if (lastValidDate) {
                    parsedDate = lastValidDate;
                    warnings.push({
                        field: 'date',
                        message: `Date is missing on this row in your sheet. Auto-assigned to previous transaction date (${lastValidDate}). Click to edit if needed.`,
                    });
                } else {
                    errors.push({ field: 'date', message: 'Valid date is required (e.g. DD/MM/YYYY or DD/MM/YY)' });
                }
            } else {
                lastValidDate = parsedDate;
            }

            // 2. Amounts
            const saleAmount = this.parseAmount(getVal('saleAmount'));
            const returnedAmount = this.parseAmount(getVal('returnedAmount'));
            const paymentReceivedAmount = this.parseAmount(getVal('paymentReceivedAmount'));

            const hasSale = saleAmount > 0;
            const hasReturn = returnedAmount > 0;
            const hasPayment = paymentReceivedAmount > 0;

            let txType: 'SALE' | 'RETURN' | 'PAYMENT' | 'MIXED' | 'INVALID' = 'INVALID';
            let effectiveAmount = 0;

            const nonZeroCount = (hasSale ? 1 : 0) + (hasReturn ? 1 : 0) + (hasPayment ? 1 : 0);

            if (nonZeroCount === 0) {
                errors.push({ field: 'amount', message: 'Row must have at least one non-zero Amount, Returned, or Payment' });
            } else if (nonZeroCount > 1) {
                txType = 'MIXED';
                warnings.push({ field: 'amount', message: 'Multiple amounts on same row (will create separate corresponding transactions)' });
            } else if (hasSale) {
                txType = 'SALE';
                effectiveAmount = saleAmount;
                currentRunningBalance = round2(currentRunningBalance + saleAmount);
            } else if (hasReturn) {
                txType = 'RETURN';
                effectiveAmount = returnedAmount;
                currentRunningBalance = round2(currentRunningBalance - returnedAmount);
            } else if (hasPayment) {
                txType = 'PAYMENT';
                effectiveAmount = paymentReceivedAmount;
                currentRunningBalance = round2(currentRunningBalance - paymentReceivedAmount);
            }

            if (txType === 'MIXED') {
                currentRunningBalance = round2(currentRunningBalance + saleAmount - returnedAmount - paymentReceivedAmount);
            }

            let description = String(getVal('description') || '').trim();
            if (description.includes('\n') || description.includes('\r')) {
                description = description
                    .replace(/[\r\n]+/g, ', ')
                    .replace(/,\s*(?:,\s*)+/g, ', ')
                    .replace(/^,\s*/, '')
                    .replace(/,\s*$/, '')
                    .trim();
            }
            const reference = String(getVal('reference') || '').trim();
            const notes = String(getVal('notes') || '').trim();

            const rowData: KhataImportRow = {
                date: parsedDate || String(rawDate || ''),
                description: description || undefined,
                saleAmount: hasSale ? saleAmount : undefined,
                returnedAmount: hasReturn ? returnedAmount : undefined,
                paymentReceivedAmount: hasPayment ? paymentReceivedAmount : undefined,
                reference: reference || undefined,
                notes: notes || undefined,
            };

            validationResults.push({
                rowIndex: idx + 1,
                data: rowData,
                isValid: errors.length === 0,
                txType,
                effectiveAmount,
                projectedRunningBalance: currentRunningBalance,
                errors,
                warnings,
            });
        }

        const validCount = validationResults.filter(r => r.isValid).length;
        const invalidCount = validationResults.length - validCount;

        return {
            customer: { id: customer.id, name: customer.name, currentBalance: customer.outstandingAmount },
            totalRows: validationResults.length,
            validCount,
            invalidCount,
            mapping,
            headers,
            validationResults,
            startingBalance: customer.outstandingAmount,
            projectedBalance: currentRunningBalance,
        };
    }

    /**
     * Chronologically execute customer transaction batch imports.
     */
    async executeCustomerKhataImport(orgId: string, customerId: string, rows: KhataImportRow[], userId?: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, orgId },
            select: { id: true, name: true, outstandingAmount: true },
        });

        if (!customer) {
            throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
        }

        // Sort rows by date ascending
        const sortedRows = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let importedTransactionsCount = 0;

        await this.prisma.$transaction(async (tx) => {
            for (const row of sortedRows) {
                const dateObj = new Date(row.date);

                // 1. Sale transaction
                if ((row.saleAmount ?? 0) > 0) {
                    await tx.customerTransaction.create({
                        data: {
                            orgId,
                            customerId,
                            date: dateObj,
                            type: CustomerTransactionType.SALE,
                            amount: row.saleAmount!,
                            description: row.description || 'Goods Given (Imported)',
                            reference: row.reference,
                            notes: row.notes,
                        },
                    });
                    importedTransactionsCount++;
                }

                // 2. Return transaction
                if ((row.returnedAmount ?? 0) > 0) {
                    await tx.customerTransaction.create({
                        data: {
                            orgId,
                            customerId,
                            date: dateObj,
                            type: CustomerTransactionType.RETURN,
                            amount: row.returnedAmount!,
                            description: row.description || 'Goods Returned (Imported)',
                            reference: row.reference,
                            notes: row.notes,
                        },
                    });
                    importedTransactionsCount++;
                }

                // 3. Payment transaction
                if ((row.paymentReceivedAmount ?? 0) > 0) {
                    await tx.customerTransaction.create({
                        data: {
                            orgId,
                            customerId,
                            date: dateObj,
                            type: CustomerTransactionType.PAYMENT,
                            amount: row.paymentReceivedAmount!,
                            description: row.description || 'Payment Received (Imported)',
                            reference: row.reference,
                            notes: row.notes,
                        },
                    });
                    importedTransactionsCount++;
                }
            }

            // Recalculate customer balance authoritatively
            const allTx = await tx.customerTransaction.findMany({
                where: { orgId, customerId },
                select: { type: true, amount: true },
            });
            const summary = CustomerLedgerCalculationEngine.computeSummary(allTx);

            await tx.customer.update({
                where: { id: customerId },
                data: { outstandingAmount: summary.netBalance },
            });
        });

        // Invalidate Redis cache
        if (this.redis) {
            try {
                await this.redis.del(`ledger:${orgId}:${customerId}`);
                await this.redis.del(`analytics:${orgId}:*`);
            } catch {}
        }

        const updatedCustomer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            select: { outstandingAmount: true },
        });

        // Safely record audit trail for batch import
        try {
            if (this.prisma?.auditLog?.create) {
                await this.prisma.auditLog.create({
                data: {
                    orgId,
                    userId: userId || null,
                    action: 'IMPORT',
                    entityType: 'CUSTOMER_KHATA_IMPORT',
                    entityId: customerId,
                    oldValue: JSON.stringify({
                        previousOutstanding: Number(customer.outstandingAmount || 0),
                    }),
                    newValue: JSON.stringify({
                        customerId,
                        customerName: customer.name,
                        importedTransactionsCount,
                        newOutstandingAmount: Number(updatedCustomer?.outstandingAmount ?? 0),
                        timestamp: new Date().toISOString(),
                    }),
                },
            });
            }
        } catch (auditErr) {
            this.logger.warn(`Failed to log audit for customer khata import: ${customerId}`, auditErr);
        }

        return {
            success: true,
            importedTransactionsCount,
            newOutstandingAmount: updatedCustomer?.outstandingAmount ?? 0,
        };
    }

    /**
     * Generate sample Excel template matching the user's Khata format.
     */
    generateKhataTemplate(customerName = 'Sunny'): Buffer {
        const wb = XLSX.utils.book_new();

        const sampleRows = [
            {
                'DATE*': '2026-01-10',
                [`GOODS GIVEN TO ${customerName.toUpperCase()}`]: '10 Bags Cement',
                'AMOUNT': 3800,
                'RETURNED': '',
                'PAYMENT RECEIVED': '',
                'REFERENCE': 'BILL-101',
                'NOTES': 'Site delivery',
            },
            {
                'DATE*': '2026-01-15',
                [`GOODS GIVEN TO ${customerName.toUpperCase()}`]: 'Payment received via Cash',
                'AMOUNT': '',
                'RETURNED': '',
                'PAYMENT RECEIVED': 2000,
                'REFERENCE': 'REC-01',
                'NOTES': 'Cash received at shop',
            },
            {
                'DATE*': '2026-01-18',
                [`GOODS GIVEN TO ${customerName.toUpperCase()}`]: '1 Bag Cement Damaged',
                'AMOUNT': '',
                'RETURNED': 380,
                'PAYMENT RECEIVED': '',
                'REFERENCE': 'RET-01',
                'NOTES': 'Damaged bag returned',
            },
            {
                'DATE*': '2026-01-20',
                [`GOODS GIVEN TO ${customerName.toUpperCase()}`]: '2 Buckets Roff Epoxy',
                'AMOUNT': 3200,
                'RETURNED': '',
                'PAYMENT RECEIVED': '',
                'REFERENCE': 'BILL-112',
                'NOTES': '',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(sampleRows);
        ws['!cols'] = [
            { wch: 14 }, // Date
            { wch: 32 }, // Goods Given
            { wch: 14 }, // Amount
            { wch: 14 }, // Returned
            { wch: 18 }, // Payment Received
            { wch: 16 }, // Reference
            { wch: 24 }, // Notes
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Khata Statement');

        // Instructions
        const instructions = [
            { 'Column': 'DATE', 'Description': 'Transaction date in YYYY-MM-DD or DD/MM/YYYY format.' },
            { 'Column': 'GOODS GIVEN', 'Description': 'Description of goods, cement bags, adhesive, or item description.' },
            { 'Column': 'AMOUNT', 'Description': 'Sale value (+Debit). Increases customer debt.' },
            { 'Column': 'RETURNED', 'Description': 'Goods returned / Credit Note (-Credit). Reduces customer debt.' },
            { 'Column': 'PAYMENT RECEIVED', 'Description': 'Cash, UPI, or cheque payment received from customer (-Credit). Reduces customer debt.' },
        ];
        const wsInst = XLSX.utils.json_to_sheet(instructions);
        wsInst['!cols'] = [{ wch: 20 }, { wch: 90 }];
        XLSX.utils.book_append_sheet(wb, wsInst, 'Instructions');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
}
