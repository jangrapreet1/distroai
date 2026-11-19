import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { parseBufferToWorkbook } from '../common/utils/import-buffer.util';

export interface SupplierImportRow {
    date: string;
    billNumber?: string;
    itemDescription?: string;
    quantity?: number;
    unitCost?: number;
    purchaseAmount?: number;
    returnedAmount?: number;
    paymentMadeAmount?: number;
    notes?: string;
}

export interface SupplierValidationResult {
    rowIndex: number;
    data: SupplierImportRow;
    isValid: boolean;
    rowType: 'PURCHASE' | 'PAYMENT' | 'RETURN' | 'MIXED' | 'INVALID';
    effectiveAmount: number;
    projectedRunningBalance: number;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
}

const SUPPLIER_HEADER_SYNONYMS: Record<keyof SupplierImportRow, string[]> = {
    date: ['date', 'purchase date', 'bill date', 'invoice date', 'tx date', 'entry date', 'dt'],
    billNumber: ['bill no', 'bill number', 'invoice no', 'invoice number', 'po no', 'po number', 'ref', 'reference', 'voucher no', 'doc no'],
    itemDescription: ['item', 'item name', 'item description', 'description', 'particulars', 'product', 'goods', 'material', 'items received'],
    quantity: ['quantity', 'qty', 'units', 'pieces', 'bags', 'nos', 'received qty'],
    unitCost: ['unit cost', 'cost', 'rate', 'unit price', 'cost price', 'purchase rate', 'price', 'cost of 1'],
    purchaseAmount: ['purchase amount', 'worth', 'amount', 'total amount', 'purchase worth', 'credit', 'cr', 'bill amount', 'worth items received'],
    returnedAmount: ['returned', 'return', 'return amount', 'goods returned', 'debit note', 'dr note', 'purchase return'],
    paymentMadeAmount: ['payment made', 'payment', 'paid', 'amount paid', 'debit', 'dr', 'paid amount', 'paid to vendor'],
    notes: ['notes', 'remarks', 'comment', 'narration'],
};

@Injectable()
export class SuppliersImportService {
    private readonly logger = new Logger(SuppliersImportService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis?: RedisService,
    ) { }

    private round2(n: number): number {
        return Math.round(n * 100) / 100;
    }

    private normalizeHeader(header: string): string {
        return header.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    private parseDate(val: any): string | null {
        if (!val) return null;
        if (val instanceof Date && !isNaN(val.getTime())) {
            return val.toISOString().slice(0, 10);
        }
        if (typeof val === 'number') {
            const parsed = XLSX.SSF.parse_date_code(val);
            if (parsed) {
                const mm = String(parsed.m).padStart(2, '0');
                const dd = String(parsed.d).padStart(2, '0');
                return `${parsed.y}-${mm}-${dd}`;
            }
        }
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

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

        const timestamp = Date.parse(s);
        if (!isNaN(timestamp)) {
            return new Date(timestamp).toISOString().slice(0, 10);
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

    private parseNum(val: any): number {
        if (val === undefined || val === '' || val === null) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : this.round2(Math.abs(val));

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
        return this.round2(total);
    }

    private detectColumnMapping(headers: string[]): Record<keyof SupplierImportRow, string | null> {
        const mapping: Record<keyof SupplierImportRow, string | null> = {
            date: null,
            billNumber: null,
            itemDescription: null,
            quantity: null,
            unitCost: null,
            purchaseAmount: null,
            returnedAmount: null,
            paymentMadeAmount: null,
            notes: null,
        };

        const normalizedHeaders = headers.map(h => ({ original: h, norm: this.normalizeHeader(h) }));

        for (const [field, synonyms] of Object.entries(SUPPLIER_HEADER_SYNONYMS)) {
            for (const h of normalizedHeaders) {
                if (synonyms.includes(h.norm) || synonyms.some(syn => h.norm.startsWith(syn))) {
                    mapping[field as keyof SupplierImportRow] = h.original;
                    break;
                }
            }
        }

        return mapping;
    }

    /**
     * Preview uploaded supplier purchases/statement sheet.
     */
    async previewSupplierPurchases(orgId: string, supplierId: string, fileBuffer: Buffer) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id: supplierId, orgId },
            select: { id: true, name: true, phone: true, outstandingBalance: true },
        });

        if (!supplier) {
            throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
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
            throw new BadRequestException({ code: 'NO_DATA', message: 'The sheet contains no data rows.' });
        }

        // Detect header row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
            const rowStr = rawJson[i].map((c: any) => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('date') || rowStr.includes('item') || rowStr.includes('purchase') || rowStr.includes('bill') || rowStr.includes('amount') || rowStr.includes('payment')) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = (rawJson[headerRowIndex] || []).map((h: any) => String(h).trim()).filter(Boolean);
        const dataRows = rawJson.slice(headerRowIndex + 1);
        const mapping = this.detectColumnMapping(headers);

        const validationResults: SupplierValidationResult[] = [];
        let currentRunningBalance = Number(supplier.outstandingBalance || 0);
        let lastValidDate: string | null = null;

        for (let idx = 0; idx < dataRows.length; idx++) {
            const rawRow = dataRows[idx];
            if (!rawRow || rawRow.every((val: any) => val === '' || val === null || val === undefined)) {
                continue;
            }

            // Skip trailing account summary and footer total rows (e.g. "ACCOUNT SUMMARY", "TOTAL PURCHASES", "BALANCE")
            if (this.isSummaryOrFooterRow(rawRow)) {
                continue;
            }

            const getVal = (field: keyof SupplierImportRow): any => {
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
                        message: `Date is missing on this row in your CSV. Auto-assigned to previous transaction date (${lastValidDate}). Click to edit if needed.`,
                    });
                } else {
                    errors.push({ field: 'date', message: 'Valid date is required (DD/MM/YYYY or DD/MM/YY)' });
                }
            } else {
                lastValidDate = parsedDate;
            }

            // 2. Quantities & Costs
            const quantity = this.parseNum(getVal('quantity'));
            const unitCost = this.parseNum(getVal('unitCost'));
            let purchaseAmount = this.parseNum(getVal('purchaseAmount'));

            // Auto-calculate purchase amount if qty & cost are given but amount is blank
            if (purchaseAmount === 0 && quantity > 0 && unitCost > 0) {
                purchaseAmount = this.round2(quantity * unitCost);
            }

            const returnedAmount = this.parseNum(getVal('returnedAmount'));
            const paymentMadeAmount = this.parseNum(getVal('paymentMadeAmount'));

            const hasPurchase = purchaseAmount > 0;
            const hasReturn = returnedAmount > 0;
            const hasPayment = paymentMadeAmount > 0;

            let rowType: 'PURCHASE' | 'PAYMENT' | 'RETURN' | 'MIXED' | 'INVALID' = 'INVALID';
            let effectiveAmount = 0;

            const nonZeroCount = (hasPurchase ? 1 : 0) + (hasReturn ? 1 : 0) + (hasPayment ? 1 : 0);

            if (nonZeroCount === 0) {
                errors.push({ field: 'amount', message: 'Row must have at least one of Purchase Amount, Returned, or Payment Made' });
            } else if (nonZeroCount > 1) {
                rowType = 'MIXED';
                warnings.push({ field: 'amount', message: 'Multiple amounts on same row (will create separate corresponding records)' });
                currentRunningBalance = this.round2(currentRunningBalance + purchaseAmount - returnedAmount - paymentMadeAmount);
            } else if (hasPurchase) {
                rowType = 'PURCHASE';
                effectiveAmount = purchaseAmount;
                currentRunningBalance = this.round2(currentRunningBalance + purchaseAmount);
            } else if (hasReturn) {
                rowType = 'RETURN';
                effectiveAmount = returnedAmount;
                currentRunningBalance = this.round2(currentRunningBalance - returnedAmount);
            } else if (hasPayment) {
                rowType = 'PAYMENT';
                effectiveAmount = paymentMadeAmount;
                currentRunningBalance = this.round2(currentRunningBalance - paymentMadeAmount);
            }

            const billNumber = String(getVal('billNumber') || '').trim();
            let itemDescription = String(getVal('itemDescription') || '').trim();
            if (itemDescription.includes('\n') || itemDescription.includes('\r')) {
                itemDescription = itemDescription
                    .replace(/[\r\n]+/g, ', ')
                    .replace(/,\s*(?:,\s*)+/g, ', ')
                    .replace(/^,\s*/, '')
                    .replace(/,\s*$/, '')
                    .trim();
            }
            const notes = String(getVal('notes') || '').trim();

            const rowData: SupplierImportRow = {
                date: parsedDate || String(rawDate || ''),
                billNumber: billNumber || undefined,
                itemDescription: itemDescription || undefined,
                quantity: quantity > 0 ? quantity : undefined,
                unitCost: unitCost > 0 ? unitCost : undefined,
                purchaseAmount: hasPurchase ? purchaseAmount : undefined,
                returnedAmount: hasReturn ? returnedAmount : undefined,
                paymentMadeAmount: hasPayment ? paymentMadeAmount : undefined,
                notes: notes || undefined,
            };

            validationResults.push({
                rowIndex: idx + 1,
                data: rowData,
                isValid: errors.length === 0,
                rowType,
                effectiveAmount,
                projectedRunningBalance: currentRunningBalance,
                errors,
                warnings,
            });
        }

        const validCount = validationResults.filter(r => r.isValid).length;
        const invalidCount = validationResults.length - validCount;

        return {
            supplier: { id: supplier.id, name: supplier.name, currentBalance: supplier.outstandingBalance },
            totalRows: validationResults.length,
            validCount,
            invalidCount,
            mapping,
            headers,
            validationResults,
            startingBalance: supplier.outstandingBalance,
            projectedBalance: currentRunningBalance,
        };
    }

    /**
     * Execute transactional import of supplier purchases & payment expenses.
     */
    async executeSupplierPurchasesImport(
        orgId: string,
        supplierId: string,
        rows: SupplierImportRow[],
        options: { updateInventory?: boolean; skipErrors?: boolean } = {}
    ) {
        const updateInventory = options.updateInventory ?? true;

        const supplier = await this.prisma.supplier.findFirst({
            where: { id: supplierId, orgId },
            select: { id: true, name: true, outstandingBalance: true },
        });

        if (!supplier) {
            throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
        }

        const defaultWarehouse = await this.prisma.warehouse.findFirst({
            where: { orgId, isDefault: true },
        }) || await this.prisma.warehouse.findFirst({
            where: { orgId },
        });

        // Sort rows by date ascending
        const sortedRows = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let createdPosCount = 0;
        let createdPaymentsCount = 0;
        let totalNetChange = 0;

        await this.prisma.$transaction(async (tx) => {
            for (let i = 0; i < sortedRows.length; i++) {
                const row = sortedRows[i];
                const rowDate = new Date(row.date);

                // 1. Purchase Order (Purchase Amount > 0)
                if ((row.purchaseAmount ?? 0) > 0) {
                    const poAmount = row.purchaseAmount!;
                    const poNum = row.billNumber || `PO-${rowDate.getFullYear()}-${String(Date.now()).slice(-4)}${i + 1}`;

                    // Check if PO with this number already exists
                    let po = await tx.purchaseOrder.findFirst({
                        where: { orgId, poNumber: poNum },
                    });

                    if (!po) {
                        po = await tx.purchaseOrder.create({
                            data: {
                                orgId,
                                supplierId,
                                poNumber: poNum,
                                status: 'RECEIVED' as any,
                                totalAmount: poAmount,
                                paidAmount: 0,
                                paymentStatus: 'UNPAID',
                                receivedDate: rowDate,
                                createdAt: rowDate,
                                notes: row.notes || (row.itemDescription ? `Items: ${row.itemDescription}` : undefined),
                            },
                        });
                        createdPosCount++;
                    }

                    // Handle Purchase Order Item
                    const isPlaceholder = !row.itemDescription || row.itemDescription.trim() === '' || row.itemDescription.trim().toLowerCase() === 'general purchase goods';
                    const itemName = isPlaceholder ? 'General Purchase Goods' : row.itemDescription!.trim();
                    let product = await tx.product.findFirst({
                        where: {
                            orgId,
                            name: { equals: itemName, mode: 'insensitive' },
                        },
                    });

                    if (!product) {
                        // Create product catalog entry for this item
                        const sku = `SUP-${itemName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
                        product = await tx.product.create({
                            data: {
                                orgId,
                                name: itemName,
                                sku,
                                purchasePrice: row.unitCost || poAmount,
                                sellingPrice: this.round2((row.unitCost || poAmount) * 1.25),
                                mrp: this.round2((row.unitCost || poAmount) * 1.35),
                                unit: 'Pieces',
                                gstRate: 18,
                                category: isPlaceholder ? 'INTERNAL_LEDGER' : undefined,
                                isActive: !isPlaceholder, // Financial placeholders must never appear in active inventory/catalog
                            },
                        });
                    } else if (isPlaceholder && (product.isActive || product.category !== 'INTERNAL_LEDGER')) {
                        // Ensure placeholder products remain hidden from active inventory and catalogs
                        await tx.product.update({
                            where: { id: product.id },
                            data: { isActive: false, category: 'INTERNAL_LEDGER' },
                        });
                    }

                    const hasExplicitQty = row.quantity !== undefined && row.quantity !== null && Number(row.quantity) > 0;
                    const qty = hasExplicitQty ? Math.round(Number(row.quantity)) : 0;
                    const price = row.unitCost && Number(row.unitCost) > 0 ? Number(row.unitCost) : 0;

                    await tx.purchaseOrderItem.create({
                        data: {
                            poId: po.id,
                            productId: product.id,
                            orderedQty: qty,
                            receivedQty: qty,
                            price,
                            totalAmount: poAmount,
                        },
                    });

                    // Add to warehouse inventory only if explicitly enabled, has a real quantity, and is not a financial placeholder
                    if (updateInventory && defaultWarehouse && qty > 0 && !isPlaceholder) {
                        const existingInv = await tx.inventory.findFirst({
                            where: { productId: product.id, warehouseId: defaultWarehouse.id },
                        });

                        if (existingInv) {
                            await tx.inventory.update({
                                where: { id: existingInv.id },
                                data: { quantity: existingInv.quantity + qty },
                            });
                        } else {
                            await tx.inventory.create({
                                data: {
                                    orgId,
                                    productId: product.id,
                                    warehouseId: defaultWarehouse.id,
                                    quantity: qty,
                                },
                            });
                        }
                    }

                    totalNetChange += poAmount;
                }

                // 2. Expense / Payment Made (Payment Made > 0)
                if ((row.paymentMadeAmount ?? 0) > 0) {
                    const payAmount = row.paymentMadeAmount!;
                    await tx.expense.create({
                        data: {
                            orgId,
                            type: 'OPERATIONAL',
                            category: 'Supplier Payment',
                            vendorName: supplier.name,
                            amount: payAmount,
                            date: rowDate,
                            paymentMethod: 'BANK_TRANSFER',
                            status: 'PAID',
                            notes: row.notes || (row.billNumber ? `Paid against Bill ${row.billNumber}` : undefined),
                        },
                    });
                    createdPaymentsCount++;
                    totalNetChange -= payAmount;
                }

                // 3. Returned (Returned > 0)
                if ((row.returnedAmount ?? 0) > 0) {
                    const returnAmount = row.returnedAmount!;
                    await tx.expense.create({
                        data: {
                            orgId,
                            type: 'OPERATIONAL',
                            category: 'Supplier Return Credit',
                            vendorName: supplier.name,
                            amount: -returnAmount, // negative expense reduces payable
                            date: rowDate,
                            status: 'PAID',
                            notes: row.notes || `Goods returned credit: ${returnAmount}`,
                        },
                    });
                    totalNetChange -= returnAmount;
                }
            }

            // Update supplier outstanding balance
            const newBalance = this.round2(Number(supplier.outstandingBalance || 0) + totalNetChange);
            await tx.supplier.update({
                where: { id: supplierId },
                data: { outstandingBalance: newBalance },
            });
        });

        // Invalidate Redis caches
        if (this.redis) {
            try {
                await this.redis.del(`suppliers:${orgId}:*`);
                await this.redis.del(`analytics:${orgId}:*`);
            } catch {}
        }

        const updatedSupplier = await this.prisma.supplier.findUnique({
            where: { id: supplierId },
            select: { outstandingBalance: true },
        });

        return {
            success: true,
            createdOrdersCount: createdPosCount,
            createdPaymentsCount,
            newOutstandingBalance: updatedSupplier?.outstandingBalance ?? 0,
        };
    }

    /**
     * Generate sample Excel template matching vendor purchases statement.
     */
    generateSupplierTemplate(supplierName = 'Ronak'): Buffer {
        const wb = XLSX.utils.book_new();

        const sampleRows = [
            {
                'DATE*': '2026-01-05',
                'BILL / PO NUMBER': 'BILL-891',
                'ITEM DESCRIPTION*': 'Roff Tile Adhesive 20kg',
                'QUANTITY': 100,
                'UNIT COST': 240,
                'PURCHASE AMOUNT': 24000,
                'RETURNED': '',
                'PAYMENT MADE': '',
                'NOTES': `Invoice from ${supplierName}`,
            },
            {
                'DATE*': '2026-01-12',
                'BILL / PO NUMBER': 'CHQ-104',
                'ITEM DESCRIPTION*': 'Payment via Bank Transfer',
                'QUANTITY': '',
                'UNIT COST': '',
                'PURCHASE AMOUNT': '',
                'RETURNED': '',
                'PAYMENT MADE': 15000,
                'NOTES': 'HDFC Bank NEFT',
            },
            {
                'DATE*': '2026-01-18',
                'BILL / PO NUMBER': 'RET-02',
                'ITEM DESCRIPTION*': '2 Bags damaged returned',
                'QUANTITY': 2,
                'UNIT COST': 240,
                'PURCHASE AMOUNT': '',
                'RETURNED': 480,
                'PAYMENT MADE': '',
                'NOTES': 'Credit Note',
            },
            {
                'DATE*': '2026-01-25',
                'BILL / PO NUMBER': 'BILL-920',
                'ITEM DESCRIPTION*': 'Roff Epoxy Resin 5kg',
                'QUANTITY': 20,
                'UNIT COST': 1200,
                'PURCHASE AMOUNT': 24000,
                'RETURNED': '',
                'PAYMENT MADE': '',
                'NOTES': 'Second consignment',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(sampleRows);
        ws['!cols'] = [
            { wch: 14 }, // Date
            { wch: 18 }, // Bill / PO Number
            { wch: 28 }, // Item Description
            { wch: 12 }, // Quantity
            { wch: 12 }, // Unit Cost
            { wch: 18 }, // Purchase Amount
            { wch: 14 }, // Returned
            { wch: 16 }, // Payment Made
            { wch: 24 }, // Notes
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Supplier Purchases');

        const instructions = [
            { 'Rule': 'DATE', 'Description': 'Date in YYYY-MM-DD or DD/MM/YYYY format.' },
            { 'Rule': 'PURCHASE AMOUNT', 'Description': 'Bill amount (+Credit). Increases amount owed to the supplier.' },
            { 'Rule': 'PAYMENT MADE', 'Description': 'Money paid to supplier (-Debit). Reduces payable balance.' },
            { 'Rule': 'RETURNED', 'Description': 'Value of goods returned to supplier (-Debit). Reduces payable balance.' },
            { 'Rule': 'INVENTORY', 'Description': 'Quantities entered will be added to your Default Warehouse inventory.' },
        ];
        const wsInst = XLSX.utils.json_to_sheet(instructions);
        wsInst['!cols'] = [{ wch: 20 }, { wch: 90 }];
        XLSX.utils.book_append_sheet(wb, wsInst, 'Instructions');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
}
