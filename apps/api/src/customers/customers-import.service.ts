import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

export type CustomerType = 'RETAILER' | 'WHOLESALER' | 'INSTITUTION' | 'INDIVIDUAL';
export type CustomerTier = 'GOLD' | 'SILVER' | 'BRONZE';

export interface CustomerImportRow {
    name: string;
    phone?: string;
    altPhone?: string;
    contactPerson?: string;
    email?: string;
    gstNumber?: string;
    panNumber?: string;
    fullAddress?: string;
    city?: string;
    state?: string;
    pincode?: string;
    type?: CustomerType;
    tier?: CustomerTier;
    creditLimit?: number;
    creditDays?: number;
    openingBalance?: number;
    openingBalanceDate?: string;
    notes?: string;
}

export interface CustomerImportOptions {
    updateExisting?: boolean;
    createOpeningBalance?: boolean;
}

export interface CustomerValidationResult {
    rowIndex: number;
    data: CustomerImportRow;
    isValid: boolean;
    isExisting: boolean;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
}

const CUSTOMER_HEADER_SYNONYMS: Record<keyof CustomerImportRow, string[]> = {
    name: ['name', 'customer name', 'party name', 'firm name', 'party', 'customer', 'account name', 'buyer name', 'client name', 'business name', 'ledger name'],
    phone: ['phone', 'mobile', 'contact', 'mobile no', 'phone no', 'whatsapp', 'whatsapp no', 'contact no', 'telephone', 'mobile number', 'cell'],
    altPhone: ['alt phone', 'alt mobile', 'secondary phone', 'alternate phone', 'landline', 'phone 2'],
    contactPerson: ['contact person', 'owner', 'proprietor', 'manager', 'person name', 'poc', 'key person'],
    email: ['email', 'email address', 'mail', 'e-mail'],
    gstNumber: ['gst', 'gstin', 'gst number', 'gst no', 'tax id', 'tax number', 'vat no'],
    panNumber: ['pan', 'pan number', 'pan no', 'it pan'],
    fullAddress: ['address', 'full address', 'billing address', 'street', 'address line', 'location address'],
    city: ['city', 'station', 'town', 'place', 'district'],
    state: ['state', 'province', 'region'],
    pincode: ['pincode', 'pin code', 'pin', 'postal code', 'zip', 'zipcode'],
    type: ['type', 'customer type', 'party type', 'category', 'segment', 'b2b/b2c', 'business type'],
    tier: ['tier', 'customer tier', 'rating', 'grade'],
    creditLimit: ['credit limit', 'credit', 'limit', 'cr limit', 'max credit'],
    creditDays: ['credit days', 'credit period', 'payment terms', 'due days', 'cr days'],
    openingBalance: ['opening balance', 'open balance', 'balance', 'starting balance', 'opening bal', 'op balance', 'op bal', 'old balance', 'ledger balance'],
    openingBalanceDate: ['opening balance date', 'balance date', 'as of date', 'date', 'op date'],
    notes: ['notes', 'remarks', 'comment', 'description'],
};

@Injectable()
export class CustomersImportService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Parse uploaded Excel buffer, auto-detect columns and validate rows.
     */
    async parseCustomerExcel(orgId: string, fileBuffer: Buffer) {
        let wb: XLSX.WorkBook;
        try {
            wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
        } catch {
            throw new BadRequestException({ code: 'INVALID_FILE', message: 'Unable to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.' });
        }

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new BadRequestException({ code: 'EMPTY_WORKBOOK', message: 'The uploaded Excel file contains no sheets.' });
        }

        let targetSheetName = wb.SheetNames.find(s =>
            s.toLowerCase().includes('customer') ||
            s.toLowerCase().includes('data') ||
            s.toLowerCase().includes('template') ||
            s.toLowerCase().includes('sheet')
        );
        if (!targetSheetName) {
            targetSheetName = wb.SheetNames.find(s =>
                !s.toLowerCase().includes('instruction') &&
                !s.toLowerCase().includes('readme') &&
                !s.toLowerCase().includes('help')
            );
        }
        if (!targetSheetName) {
            targetSheetName = wb.SheetNames[0];
        }

        const ws = wb.Sheets[targetSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        if (rawJson.length === 0) {
            throw new BadRequestException({ code: 'EMPTY_SHEET', message: 'The uploaded sheet is empty or contains no data rows.' });
        }

        // Detect all column headers from first 10 rows
        const rawHeaders = Array.from(new Set(rawJson.flatMap((r) => Object.keys(r))));
        const detectedMapping = this.autoDetectMapping(rawHeaders);

        // Fetch existing customers in this org for duplicate detection
        const existingCustomers = await this.prisma.customer.findMany({
            where: { orgId },
            select: { id: true, phone: true, gstNumber: true, name: true },
        });

        const phoneMap = new Map<string, string>();
        const gstMap = new Map<string, string>();
        for (const c of existingCustomers) {
            if (c.phone) phoneMap.set(this.cleanPhone(c.phone), c.id);
            if (c.gstNumber) gstMap.set(c.gstNumber.trim().toUpperCase(), c.id);
        }

        // Validate and map each row
        const validatedRows: CustomerValidationResult[] = [];
        let validCount = 0;
        let invalidCount = 0;

        for (let i = 0; i < rawJson.length; i++) {
            const rawRow = rawJson[i];
            const mappedRow = this.mapRow(rawRow, detectedMapping);
            const errors: { field: string; message: string }[] = [];
            const warnings: { field: string; message: string }[] = [];

            // 1. Name validation
            if (!mappedRow.name || mappedRow.name.trim().length < 2) {
                errors.push({ field: 'name', message: 'Customer/Party name is required (min 2 characters)' });
            }

            // 2. Phone validation
            const cleanPhone = mappedRow.phone ? this.cleanPhone(mappedRow.phone) : '';
            if (mappedRow.phone && cleanPhone.length !== 10) {
                errors.push({ field: 'phone', message: 'Phone must be a valid 10-digit Indian mobile number' });
            } else if (cleanPhone) {
                mappedRow.phone = cleanPhone;
            }

            // 3. GST validation
            if (mappedRow.gstNumber) {
                const cleanGst = mappedRow.gstNumber.trim().toUpperCase();
                mappedRow.gstNumber = cleanGst;
                if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst)) {
                    warnings.push({ field: 'gstNumber', message: 'GST format may be invalid (expected 15 alphanumeric characters)' });
                }
            }

            // 4. Customer Type normalization
            if (mappedRow.type) {
                mappedRow.type = this.normalizeCustomerType(mappedRow.type as any);
            }

            // 5. Duplicate check
            let isExisting = false;
            if (cleanPhone && phoneMap.has(cleanPhone)) {
                isExisting = true;
                warnings.push({ field: 'phone', message: 'Customer with this phone already exists (will be updated)' });
            } else if (mappedRow.gstNumber && gstMap.has(mappedRow.gstNumber)) {
                isExisting = true;
                warnings.push({ field: 'gstNumber', message: 'Customer with this GST already exists (will be updated)' });
            }

            // 6. Opening balance check
            if (mappedRow.openingBalance !== undefined && isNaN(Number(mappedRow.openingBalance))) {
                errors.push({ field: 'openingBalance', message: 'Opening balance must be a valid number' });
            } else if (mappedRow.openingBalance !== undefined) {
                mappedRow.openingBalance = Number(mappedRow.openingBalance);
            }

            const isValid = errors.length === 0;
            if (isValid) validCount++;
            else invalidCount++;

            validatedRows.push({
                rowIndex: i + 2, // 1-based + 1 for header
                data: mappedRow,
                isValid,
                isExisting,
                errors,
                warnings,
            });
        }

        return {
            rawHeaders,
            availableHeaders: rawHeaders,
            mapping: detectedMapping,
            detectedMapping,
            rows: validatedRows,
            validationResults: validatedRows,
            totalRows: rawJson.length,
            totalProcessed: rawJson.length,
            validCount,
            invalidCount,
        };
    }

    /**
     * Commit validated customer rows to PostgreSQL.
     */
    async executeCustomerImport(orgId: string, rows: CustomerImportRow[], options: CustomerImportOptions = {}) {
        const updateExisting = options.updateExisting !== false; // default true
        const createOpeningBalance = options.createOpeningBalance !== false; // default true

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: { row: number; error: string }[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cleanPhone = row.phone ? this.cleanPhone(row.phone) : undefined;
            const cleanGst = row.gstNumber ? row.gstNumber.trim().toUpperCase() : undefined;

            try {
                // Check if existing customer matches
                let existing: any = null;
                if (cleanPhone) {
                    existing = await this.prisma.customer.findFirst({
                        where: { orgId, phone: cleanPhone },
                    });
                }
                if (!existing && cleanGst) {
                    existing = await this.prisma.customer.findFirst({
                        where: { orgId, gstNumber: cleanGst },
                    });
                }

                if (existing) {
                    if (!updateExisting) {
                        skipped++;
                        continue;
                    }

                    // Update existing customer profile
                    await this.prisma.customer.update({
                        where: { id: existing.id },
                        data: {
                            name: row.name || existing.name,
                            contactPerson: row.contactPerson ?? existing.contactPerson,
                            email: row.email ?? existing.email,
                            altPhone: row.altPhone ?? existing.altPhone,
                            gstNumber: cleanGst ?? existing.gstNumber,
                            panNumber: row.panNumber ?? existing.panNumber,
                            fullAddress: row.fullAddress ?? existing.fullAddress,
                            city: row.city ?? existing.city,
                            state: row.state ?? existing.state,
                            pincode: row.pincode ?? existing.pincode,
                            type: row.type ?? existing.type,
                            tier: row.tier ?? existing.tier,
                            creditLimit: row.creditLimit !== undefined ? row.creditLimit : existing.creditLimit,
                            creditDays: row.creditDays !== undefined ? row.creditDays : existing.creditDays,
                            notes: row.notes ?? existing.notes,
                        },
                    });

                    // If existing customer had 0 balance and openingBalance is supplied
                    if (createOpeningBalance && row.openingBalance && row.openingBalance > 0 && existing.outstandingAmount === 0) {
                        await this.recordOpeningBalance(orgId, existing.id, row.openingBalance, row.openingBalanceDate);
                    }

                    updated++;
                } else {
                    // Create new customer
                    const newCustomer = await this.prisma.customer.create({
                        data: {
                            orgId,
                            name: row.name,
                            phone: cleanPhone,
                            altPhone: row.altPhone,
                            contactPerson: row.contactPerson,
                            email: row.email,
                            gstNumber: cleanGst,
                            panNumber: row.panNumber,
                            fullAddress: row.fullAddress,
                            city: row.city,
                            state: row.state,
                            pincode: row.pincode,
                            type: (row.type as any) ?? 'RETAILER',
                            tier: (row.tier as any) ?? 'BRONZE',
                            creditLimit: row.creditLimit ?? 0,
                            creditDays: row.creditDays ?? 0,
                            outstandingAmount: row.openingBalance ?? 0,
                            notes: row.notes,
                        },
                    });

                    if (createOpeningBalance && row.openingBalance && row.openingBalance > 0) {
                        await this.recordOpeningBalance(orgId, newCustomer.id, row.openingBalance, row.openingBalanceDate);
                    }

                    created++;
                }
            } catch (err: any) {
                errors.push({
                    row: i + 2,
                    error: err?.message || 'Failed to process row',
                });
            }
        }

        return {
            total: rows.length,
            totalProcessed: rows.length,
            created,
            createdCount: created,
            updated,
            updatedCount: updated,
            skipped,
            skippedCount: skipped,
            failed: errors.length,
            failedCount: errors.length,
            errors,
        };
    }

    /**
     * Record an opening balance in CustomerTransaction for RTK date-wise statement.
     */
    private async recordOpeningBalance(orgId: string, customerId: string, amount: number, dateStr?: string) {
        const txDate = dateStr && !isNaN(Date.parse(dateStr)) ? new Date(dateStr) : new Date();

        await this.prisma.customerTransaction.create({
            data: {
                orgId,
                customerId,
                date: txDate,
                type: 'SALE', // Opening balance acts as initial debit / sale liability
                amount,
                description: 'Opening Balance',
                reference: 'OP-BAL',
                notes: 'Imported from Excel Opening Balance',
            },
        });

        await this.prisma.customer.update({
            where: { id: customerId },
            data: { outstandingAmount: amount },
        });
    }

    /**
     * Generate stylized downloadable Excel sample template for Customers.
     */
    generateCustomerTemplate(): Buffer {
        const sampleData = [
            {
                'Party Name': 'Radhakirshan Trading Company',
                'Mobile No': '9812345678',
                'Contact Person': 'Manish Kumar',
                'Customer Type': 'Retailer',
                'GST Number': '06AAAAA0000A1Z5',
                'PAN Number': 'AAAAA0000A',
                'Address': 'Shop No. 14, Main Cloth Market',
                'City': 'Bhiwani',
                'State': 'Haryana',
                'Pincode': '127021',
                'Credit Limit': 100000,
                'Credit Days': 30,
                'Opening Balance': 45000,
                'Balance Date': '2026-09-01',
                'Notes': 'Top priority distributor retailer',
            },
            {
                'Party Name': 'Aggarwal General Store',
                'Mobile No': '9876543210',
                'Contact Person': 'Sunil Aggarwal',
                'Customer Type': 'Wholesaler',
                'GST Number': '06BBBBB1111B1Z2',
                'PAN Number': 'BBBBB1111B',
                'Address': 'Railway Road, Opp. Bus Stand',
                'City': 'Rohtak',
                'State': 'Haryana',
                'Pincode': '124001',
                'Credit Limit': 250000,
                'Credit Days': 45,
                'Opening Balance': 120000,
                'Balance Date': '2026-09-15',
                'Notes': 'Regular FMCG bulk buyer',
            },
            {
                'Party Name': 'Sharma Provisions',
                'Mobile No': '9416012345',
                'Contact Person': 'Ramesh Sharma',
                'Customer Type': 'Retailer',
                'GST Number': '',
                'PAN Number': '',
                'Address': 'Circular Road',
                'City': 'Hisar',
                'State': 'Haryana',
                'Pincode': '125001',
                'Credit Limit': 50000,
                'Credit Days': 15,
                'Opening Balance': 0,
                'Balance Date': '',
                'Notes': 'Cash on delivery buyer',
            },
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);

        // Set column widths
        ws['!cols'] = [
            { wch: 30 }, // Party Name
            { wch: 15 }, // Mobile No
            { wch: 20 }, // Contact Person
            { wch: 15 }, // Customer Type
            { wch: 18 }, // GST Number
            { wch: 14 }, // PAN Number
            { wch: 35 }, // Address
            { wch: 15 }, // City
            { wch: 15 }, // State
            { wch: 10 }, // Pincode
            { wch: 14 }, // Credit Limit
            { wch: 12 }, // Credit Days
            { wch: 16 }, // Opening Balance
            { wch: 14 }, // Balance Date
            { wch: 30 }, // Notes
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Customers Template');

        // Add Instructions sheet
        const instructions = [
            ['DistroAI — Customer Bulk Import Instructions'],
            [''],
            ['Column', 'Required?', 'Description & Allowed Values'],
            ['Party Name', 'YES', 'Name of the firm, shop, or customer (minimum 2 characters).'],
            ['Mobile No', 'YES', '10-digit Indian mobile number. Used as unique identifier to prevent duplicates.'],
            ['Customer Type', 'NO', 'Retailer, Wholesaler, Institution, or Individual (Default: Retailer).'],
            ['Contact Person', 'NO', 'Name of the proprietor or contact person.'],
            ['GST Number', 'NO', '15-character Indian GSTIN (e.g., 06AAAAA0000A1Z5).'],
            ['Address, City, State, Pincode', 'NO', 'Location details.'],
            ['Credit Limit', 'NO', 'Maximum credit allowed in Rupees (e.g. 50000).'],
            ['Credit Days', 'NO', 'Payment term in days (e.g. 15, 30, 45).'],
            ['Opening Balance', 'NO', 'Past balance pending from customer. Automatically initializes Date-Wise Ledger.'],
            ['Balance Date', 'NO', 'Date for opening balance in YYYY-MM-DD format (e.g., 2026-09-01).'],
            ['Notes', 'NO', 'Internal notes or distributor remarks.'],
        ];
        const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
        wsInstructions['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Field Instructions');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    /**
     * Match spreadsheet column headers to standard fields using synonym dictionary.
     */
    private autoDetectMapping(headers: string[]): Record<string, string> {
        const mapping: Record<string, string> = {};
        const cleanStr = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

        for (const [field, synonyms] of Object.entries(CUSTOMER_HEADER_SYNONYMS)) {
            const sortedSynonyms = [...synonyms].sort((a, b) => b.length - a.length);

            // Phase 1: Exact matches first
            let matchedHeader: string | undefined;
            for (const syn of sortedSynonyms) {
                const cSyn = cleanStr(syn);
                const found = headers.find((h) => cleanStr(h) === cSyn);
                if (found) {
                    matchedHeader = found;
                    break;
                }
            }

            // Phase 2: Substring matches if no exact match found
            if (!matchedHeader) {
                for (const syn of sortedSynonyms) {
                    const cSyn = cleanStr(syn);
                    if (!cSyn) continue;
                    const found = headers.find((h) => {
                        const cH = cleanStr(h);
                        return cH.includes(cSyn) || cSyn.includes(cH);
                    });
                    if (found) {
                        matchedHeader = found;
                        break;
                    }
                }
            }

            if (matchedHeader) {
                mapping[field] = matchedHeader;
            }
        }

        return mapping;
    }

    /**
     * Map a raw Excel row into a normalized CustomerImportRow.
     */
    private mapRow(rawRow: Record<string, unknown>, mapping: Record<string, string>): CustomerImportRow {
        const mapped: Partial<CustomerImportRow> = {};

        // 1. Map via field -> rawHeader
        for (const [field, header] of Object.entries(mapping)) {
            if (!header || header === 'unmapped') continue;
            const val = rawRow[header];
            if (val === undefined || val === null || val === '') continue;

            const strVal = String(val).trim();
            if (field === 'creditLimit' || field === 'creditDays' || field === 'openingBalance') {
                const num = Number(strVal.replace(/[^0-9.-]+/g, ''));
                (mapped as any)[field] = isNaN(num) ? undefined : num;
            } else {
                (mapped as any)[field] = strVal;
            }
        }

        // 2. Direct field fallback for unmapped or standard column names
        for (const [key, val] of Object.entries(rawRow)) {
            if (val === undefined || val === null || val === '') continue;
            const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            for (const f of Object.keys(CUSTOMER_HEADER_SYNONYMS)) {
                if (f.toLowerCase() === cleanKey && (mapped as any)[f] === undefined) {
                    const strVal = String(val).trim();
                    if (f === 'creditLimit' || f === 'creditDays' || f === 'openingBalance') {
                        const num = Number(strVal.replace(/[^0-9.-]+/g, ''));
                        (mapped as any)[f] = isNaN(num) ? undefined : num;
                    } else {
                        (mapped as any)[f] = strVal;
                    }
                }
            }
        }

        return mapped as CustomerImportRow;
    }

    /**
     * Clean phone number to 10 digits.
     */
    private cleanPhone(phone: string): string {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) return digits;
        if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
        if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
        return digits;
    }

    /**
     * Normalize customer type.
     */
    private normalizeCustomerType(typeStr?: string): CustomerType {
        if (!typeStr) return 'RETAILER';
        const upper = typeStr.toUpperCase().trim();
        if (upper.includes('WHOLE')) return 'WHOLESALER';
        if (upper.includes('INST')) return 'INSTITUTION';
        if (upper.includes('INDIV') || upper.includes('B2C')) return 'INDIVIDUAL';
        return 'RETAILER';
    }
}
