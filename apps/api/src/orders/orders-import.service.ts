import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'PACKED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type CustomerType = 'RETAILER' | 'WHOLESALER' | 'INSTITUTION' | 'INDIVIDUAL';
export type CustomerTier = 'GOLD' | 'SILVER' | 'BRONZE';

export interface OrderImportLineRow {
    orderNumber?: string;
    orderDate?: string;
    customerPhone: string;
    customerName?: string;
    productNameOrSku: string;
    quantity: number;
    unit?: string;
    price: number;
    discount?: number; // discount percentage or fixed
    taxRate?: number;
    status?: OrderStatus;
    notes?: string;
    deliveryAddress?: string;
}

export interface GroupedImportOrder {
    orderNumber: string;
    orderDate: Date;
    customerPhone: string;
    customerName?: string;
    status: OrderStatus;
    notes?: string;
    deliveryAddress?: string;
    items: {
        productNameOrSku: string;
        quantity: number;
        unit?: string;
        price: number;
        discount?: number;
        taxRate?: number;
    }[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    netAmount: number;
    isNewCustomer: boolean;
    hasUnmappedProducts: boolean;
}

const ORDER_HEADER_SYNONYMS: Record<string, string[]> = {
    orderNumber: ['voucher no', 'order no', 'order number', 'order id', 'invoice no', 'bill no', 'voucher number', 'po no', 'order #'],
    orderDate: ['date', 'order date', 'bill date', 'voucher date', 'invoice date', 'booking date'],
    customerPhone: ['party mobile', 'customer phone', 'mobile no', 'phone', 'mobile', 'contact no', 'buyer phone', 'party phone', 'mobile number'],
    customerName: ['party name', 'customer name', 'customer', 'party', 'buyer name', 'firm name', 'account', 'party/customer'],
    productNameOrSku: ['item name', 'product', 'product name', 'item', 'description', 'particulars', 'sku', 'item code', 'product code'],
    quantity: ['qty', 'quantity', 'pieces', 'units', 'nos', 'packs', 'box'],
    unit: ['unit', 'uom', 'pkg', 'measure'],
    price: ['rate', 'price', 'unit price', 'selling price', 'item rate', 'amount/unit', 'rate/unit'],
    discount: ['dis %', 'disc %', 'discount', 'disc', 'discount %', 'scheme', 'disc percent'],
    taxRate: ['gst %', 'tax %', 'tax rate', 'gst rate', 'gst', 'tax'],
    status: ['status', 'order status', 'state'],
    notes: ['notes', 'remarks', 'comment'],
    deliveryAddress: ['delivery address', 'shipping address', 'address', 'destination'],
};

@Injectable()
export class OrdersImportService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Parse uploaded Order Excel buffer, group by order number, validate and return preview.
     */
    async parseOrderExcel(orgId: string, fileBuffer: Buffer) {
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
            s.toLowerCase().includes('order') ||
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

        const rawHeaders = Array.from(new Set(rawJson.flatMap((r) => Object.keys(r))));
        const detectedMapping = this.autoDetectMapping(rawHeaders);

        // Fetch existing customers for duplicate/existing detection
        const existingCustomers = await this.prisma.customer.findMany({
            where: { orgId },
            select: { id: true, phone: true, name: true },
        });

        const customerPhoneMap = new Map<string, string>();
        for (const c of existingCustomers) {
            if (c.phone) customerPhoneMap.set(this.cleanPhone(c.phone), c.id);
        }

        const validatedLineRows: any[] = [];
        const rawRowsMapped: OrderImportLineRow[] = [];

        for (let i = 0; i < rawJson.length; i++) {
            const rawRow = rawJson[i];
            const mapped = this.mapRow(rawRow, detectedMapping);
            const lineErrors: { field: string; message: string }[] = [];

            if (!mapped.customerPhone && !mapped.customerName) {
                lineErrors.push({ field: 'customerPhone', message: 'Customer phone or party name is required' });
            }
            if (!mapped.productNameOrSku) {
                lineErrors.push({ field: 'productNameOrSku', message: 'Product name or SKU is required' });
            }

            const cleanPhone = mapped.customerPhone ? this.cleanPhone(mapped.customerPhone) : '';
            const isLineValid = lineErrors.length === 0;

            if (isLineValid) {
                rawRowsMapped.push(mapped);
            }

            validatedLineRows.push({
                rowIndex: i + 1,
                data: mapped,
                isValid: isLineValid,
                isExisting: cleanPhone ? customerPhoneMap.has(cleanPhone) : false,
                errors: lineErrors,
                warnings: [],
            });
        }

        const groupedOrders = await this.groupOrderRows(orgId, rawRowsMapped);

        return {
            rawHeaders,
            availableHeaders: rawHeaders,
            mapping: detectedMapping,
            detectedMapping,
            rows: validatedLineRows,
            validationResults: validatedLineRows,
            orders: groupedOrders,
            totalRows: rawJson.length,
            totalOrders: groupedOrders.length,
            totalProcessed: rawJson.length,
            validCount: validatedLineRows.filter((r) => r.isValid).length,
            invalidCount: validatedLineRows.filter((r) => !r.isValid).length,
            totalItems: groupedOrders.reduce((sum, o) => sum + o.items.length, 0),
            newCustomerCount: groupedOrders.filter((o) => o.isNewCustomer).length,
            unmappedProductCount: groupedOrders.filter((o) => o.hasUnmappedProducts).length,
            groupedOrderCount: groupedOrders.length,
            errors: validatedLineRows
                .filter((r) => !r.isValid)
                .map((r) => ({ row: r.rowIndex + 1, error: r.errors.map((e: any) => e.message).join(', ') })),
        };
    }

    /**
     * Group individual order line items into GroupedImportOrder structures.
     */
    async groupOrderRows(orgId: string, rows: OrderImportLineRow[]): Promise<GroupedImportOrder[]> {
        const [existingCustomers, existingProducts] = await Promise.all([
            this.prisma.customer.findMany({
                where: { orgId },
                select: { id: true, phone: true, name: true },
            }),
            this.prisma.product.findMany({
                where: { orgId },
                select: { id: true, sku: true, name: true, gstRate: true, unit: true, sellingPrice: true },
            }),
        ]);

        const customerPhoneMap = new Map<string, string>();
        for (const c of existingCustomers) {
            if (c.phone) customerPhoneMap.set(this.cleanPhone(c.phone), c.id);
        }

        const productSkuMap = new Map<string, typeof existingProducts[0]>();
        const productNameMap = new Map<string, typeof existingProducts[0]>();
        for (const p of existingProducts) {
            productSkuMap.set(p.sku.toLowerCase().trim(), p);
            productNameMap.set(p.name.toLowerCase().trim(), p);
        }

        const orderGroupsMap = new Map<string, GroupedImportOrder>();
        let autoOrderCounter = 1;

        for (const mapped of rows) {
            if (!mapped.customerPhone && !mapped.customerName) continue;
            if (!mapped.productNameOrSku) continue;

            const cleanPhone = mapped.customerPhone ? this.cleanPhone(mapped.customerPhone) : '';
            const orderDate = mapped.orderDate && !isNaN(Date.parse(mapped.orderDate)) ? new Date(mapped.orderDate) : new Date();

            let groupKey = mapped.orderNumber?.trim();
            if (!groupKey) {
                groupKey = `AUTO-ORD-${cleanPhone || mapped.customerName}-${orderDate.toISOString().slice(0, 10)}`;
            }

            let group = orderGroupsMap.get(groupKey);
            if (!group) {
                const orderNumDisplay = mapped.orderNumber?.trim() || `ORD-IMP-${Date.now().toString().slice(-4)}-${autoOrderCounter++}`;
                const isNewCustomer = cleanPhone ? !customerPhoneMap.has(cleanPhone) : true;

                group = {
                    orderNumber: orderNumDisplay,
                    orderDate,
                    customerPhone: cleanPhone,
                    customerName: mapped.customerName,
                    status: this.normalizeOrderStatus(mapped.status as any),
                    notes: mapped.notes,
                    deliveryAddress: mapped.deliveryAddress,
                    items: [],
                    subtotal: 0,
                    discountAmount: 0,
                    taxAmount: 0,
                    netAmount: 0,
                    isNewCustomer,
                    hasUnmappedProducts: false,
                };
                orderGroupsMap.set(groupKey, group);
            }

            const itemKey = mapped.productNameOrSku.toLowerCase().trim();
            const matchedProduct = productSkuMap.get(itemKey) || productNameMap.get(itemKey);
            if (!matchedProduct) {
                group.hasUnmappedProducts = true;
            }

            const qty = Math.max(1, Number(mapped.quantity) || 1);
            const price = mapped.price !== undefined && !isNaN(Number(mapped.price))
                ? Number(mapped.price)
                : (matchedProduct?.sellingPrice ?? 0);
            const discountPct = Number(mapped.discount) || 0;
            const taxPct = mapped.taxRate !== undefined && !isNaN(Number(mapped.taxRate))
                ? Number(mapped.taxRate)
                : (matchedProduct?.gstRate ?? 18);

            const lineSubtotal = price * qty;
            const lineDiscount = (lineSubtotal * discountPct) / 100;
            const taxable = lineSubtotal - lineDiscount;
            const lineTax = (taxable * taxPct) / 100;

            group.items.push({
                productNameOrSku: mapped.productNameOrSku,
                quantity: qty,
                unit: mapped.unit || matchedProduct?.unit || 'Pieces',
                price,
                discount: lineDiscount,
                taxRate: taxPct,
            });

            group.subtotal += lineSubtotal;
            group.discountAmount += lineDiscount;
            group.taxAmount += lineTax;
            group.netAmount += taxable + lineTax;
        }

        return Array.from(orderGroupsMap.values()).map((o) => ({
            ...o,
            subtotal: Math.round(o.subtotal * 100) / 100,
            discountAmount: Math.round(o.discountAmount * 100) / 100,
            taxAmount: Math.round(o.taxAmount * 100) / 100,
            netAmount: Math.round(o.netAmount * 100) / 100,
        }));
    }

    /**
     * Execute Order Import into PostgreSQL database.
     */
    async executeOrderImport(orgId: string, orders: GroupedImportOrder[], userId: string) {
        let createdOrders = 0;
        let createdCustomers = 0;
        let createdProducts = 0;
        const errors: { orderNumber: string; error: string }[] = [];

        // Ensure default warehouse exists
        let warehouse: any = await this.prisma.warehouse.findFirst({ where: { orgId, isDefault: true } });
        if (!warehouse) {
            warehouse = await this.prisma.warehouse.findFirst({ where: { orgId } });
        }
        if (!warehouse) {
            warehouse = await this.prisma.warehouse.create({
                data: { orgId, name: 'Main Warehouse', code: 'WH-MAIN', isDefault: true },
            });
        }

        for (const orderData of orders) {
            try {
                // 1. Resolve or auto-create Customer
                let customer: any = null;
                if (orderData.customerPhone) {
                    customer = await this.prisma.customer.findFirst({
                        where: { orgId, phone: orderData.customerPhone },
                    });
                }
                if (!customer && orderData.customerName) {
                    customer = await this.prisma.customer.findFirst({
                        where: { orgId, name: { equals: orderData.customerName, mode: 'insensitive' } },
                    });
                }

                if (!customer) {
                    customer = await this.prisma.customer.create({
                        data: {
                            orgId,
                            name: orderData.customerName || `Customer ${orderData.customerPhone}`,
                            phone: orderData.customerPhone || undefined,
                            type: 'RETAILER',
                            tier: 'BRONZE',
                        },
                    });
                    createdCustomers++;
                }

                // 2. Resolve or auto-create Products for items
                const orderItemsToCreate: any[] = [];
                for (const item of orderData.items) {
                    const itemKey = item.productNameOrSku.trim();
                    let product = await this.prisma.product.findFirst({
                        where: {
                            orgId,
                            OR: [
                                { sku: { equals: itemKey, mode: 'insensitive' } },
                                { name: { equals: itemKey, mode: 'insensitive' } },
                            ],
                        },
                    });

                    if (!product) {
                        // Auto-create product with standard defaults
                        const generatedSku = `SKU-${itemKey.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
                        product = await this.prisma.product.create({
                            data: {
                                orgId,
                                sku: generatedSku,
                                name: itemKey,
                                sellingPrice: item.price,
                                purchasePrice: Math.round(item.price * 0.8 * 100) / 100,
                                mrp: item.price,
                                gstRate: item.taxRate ?? 18,
                                unit: item.unit || 'Pieces',
                                category: 'General',
                                brand: 'Generic',
                                inventories: {
                                    create: { orgId, warehouseId: warehouse.id, quantity: 100 },
                                },
                            },
                        });
                        createdProducts++;
                    }

                    const lineSubtotal = item.price * item.quantity;
                    const lineDiscount = item.discount ?? 0;
                    const taxable = lineSubtotal - lineDiscount;
                    const taxRate = item.taxRate ?? product.gstRate;
                    const taxAmount = (taxable * taxRate) / 100;
                    const lineTotal = taxable + taxAmount;

                    orderItemsToCreate.push({
                        productId: product.id,
                        quantity: item.quantity,
                        unit: item.unit || product.unit,
                        price: item.price,
                        discount: lineDiscount,
                        taxRate,
                        taxAmount: Math.round(taxAmount * 100) / 100,
                        totalAmount: Math.round(lineTotal * 100) / 100,
                    });
                }

                // Ensure unique orderNumber
                let finalOrderNumber = orderData.orderNumber;
                const existingOrder = await this.prisma.order.findFirst({
                    where: { orgId, orderNumber: finalOrderNumber },
                });
                if (existingOrder) {
                    finalOrderNumber = `${finalOrderNumber}-${Date.now().toString().slice(-4)}`;
                }

                // 3. Create Order in DB
                const newOrder = await this.prisma.order.create({
                    data: {
                        orgId,
                        orderNumber: finalOrderNumber,
                        customerId: customer.id,
                        warehouseId: warehouse.id,
                        status: orderData.status,
                        source: 'APP',
                        totalAmount: orderData.subtotal,
                        discountAmount: orderData.discountAmount,
                        taxAmount: orderData.taxAmount,
                        netAmount: orderData.netAmount,
                        balanceAmount: orderData.netAmount,
                        notes: orderData.notes,
                        deliveryAddress: orderData.deliveryAddress,
                        createdAt: orderData.orderDate,
                        items: { create: orderItemsToCreate },
                        statusHistory: {
                            create: {
                                toStatus: orderData.status,
                                changedBy: userId,
                                note: 'Imported from Excel',
                            },
                        },
                    },
                });

                // 4. If status is CONFIRMED or DELIVERED, post to CustomerTransaction ledger
                if (orderData.status === 'CONFIRMED' || orderData.status === 'DELIVERED') {
                    await this.prisma.customerTransaction.create({
                        data: {
                            orgId,
                            customerId: customer.id,
                            date: orderData.orderDate,
                            type: 'SALE',
                            amount: orderData.netAmount,
                            reference: finalOrderNumber,
                            description: `Order #${finalOrderNumber}`,
                            notes: `Imported Excel Order (${orderItemsToCreate.length} items)`,
                        },
                    });

                    // Update customer balance and last order date
                    await this.prisma.customer.update({
                        where: { id: customer.id },
                        data: {
                            outstandingAmount: { increment: orderData.netAmount },
                            lastOrderDate: orderData.orderDate,
                        },
                    });
                }

                createdOrders++;
            } catch (err: any) {
                errors.push({
                    orderNumber: orderData.orderNumber,
                    error: err?.message || 'Failed to import order',
                });
            }
        }

        return {
            totalOrders: orders.length,
            total: orders.length,
            totalProcessed: orders.length,
            createdOrders,
            createdCount: createdOrders,
            createdCustomers,
            createdProducts,
            updatedCount: 0,
            skippedCount: 0,
            failed: errors.length,
            failedCount: errors.length,
            errors,
        };
    }

    /**
     * Generate stylized downloadable Excel sample template for Orders.
     */
    generateOrderTemplate(): Buffer {
        const sampleData = [
            {
                'Order No': 'ORD-2026-001',
                'Order Date': '2026-09-20',
                'Customer Phone': '9812345678',
                'Party Name': 'Radhakrishan Trading Company',
                'Item Name': 'Fortune Sunlite Refined Oil 1L',
                'Qty': 50,
                'Unit': 'Pouch',
                'Rate': 142.50,
                'Dis %': 2,
                'GST %': 5,
                'Status': 'CONFIRMED',
                'Notes': 'Delivery before 5 PM',
                'Delivery Address': 'Shop No. 14, Main Market, Bhiwani',
            },
            {
                'Order No': 'ORD-2026-001',
                'Order Date': '2026-09-20',
                'Customer Phone': '9812345678',
                'Party Name': 'Radhakrishan Trading Company',
                'Item Name': 'Tata Salt Vacuum Evaporated 1kg',
                'Qty': 100,
                'Unit': 'Packet',
                'Rate': 24.00,
                'Dis %': 0,
                'GST %': 0,
                'Status': 'CONFIRMED',
                'Notes': 'Delivery before 5 PM',
                'Delivery Address': 'Shop No. 14, Main Market, Bhiwani',
            },
            {
                'Order No': 'ORD-2026-002',
                'Order Date': '2026-09-21',
                'Customer Phone': '9876543210',
                'Party Name': 'Aggarwal General Store',
                'Item Name': 'Aashirvaad Shudh Chakki Atta 10kg',
                'Qty': 25,
                'Unit': 'Bag',
                'Rate': 410.00,
                'Dis %': 3,
                'GST %': 0,
                'Status': 'DRAFT',
                'Notes': 'Draft order for review',
                'Delivery Address': 'Railway Road, Rohtak',
            },
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);

        ws['!cols'] = [
            { wch: 16 }, // Order No
            { wch: 14 }, // Order Date
            { wch: 16 }, // Customer Phone
            { wch: 30 }, // Party Name
            { wch: 35 }, // Item Name
            { wch: 10 }, // Qty
            { wch: 10 }, // Unit
            { wch: 12 }, // Rate
            { wch: 10 }, // Dis %
            { wch: 10 }, // GST %
            { wch: 14 }, // Status
            { wch: 25 }, // Notes
            { wch: 35 }, // Delivery Address
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Orders Template');

        const instructions = [
            ['DistroAI — Orders Bulk Import Instructions & Status Guide'],
            [''],
            ['Column', 'Required?', 'Description & Allowed Values'],
            ['Order No', 'NO', 'Invoice or Order identifier. Lines with the same Order No are grouped into one single multi-item invoice.'],
            ['Order Date', 'NO', 'Date of the order (YYYY-MM-DD format). Defaults to today if omitted.'],
            ['Customer Phone', 'YES', '10-digit Indian mobile number of the customer. Used to link order to customer account.'],
            ['Party Name', 'NO', 'Name of customer. If customer is not found by phone, an account is auto-created with this name.'],
            ['Item Name', 'YES', 'Product name or SKU. If product does not exist, it will be automatically cataloged.'],
            ['Qty', 'YES', 'Quantity ordered (positive integer, e.g. 10, 50).'],
            ['Unit', 'NO', 'Unit of measurement (e.g. Pieces, Box, Kg, Packet, Pouch). Defaults to Pieces.'],
            ['Rate', 'YES', 'Selling price per unit excluding or including tax.'],
            ['Dis %', 'NO', 'Discount percentage on this line (e.g. 2 for 2%, 5 for 5%). Defaults to 0.'],
            ['GST %', 'NO', 'GST tax rate percentage (e.g. 0, 5, 12, 18, 28). Defaults to product rate or 18%.'],
            ['Status', 'NO', 'CONFIRMED, DRAFT, DELIVERED, or CANCELLED. Default is CONFIRMED.'],
            ['Notes', 'NO', 'Special instructions, remarks, or delivery notes.'],
            ['Delivery Address', 'NO', 'Shipping or delivery destination address.'],
            [''],
            ['ORDER STATUS BEHAVIOR IN DISTROAI:'],
            ['• CONFIRMED / DELIVERED: Creates order, reserves warehouse inventory, and immediately posts a SALE transaction to the customer date-wise ledger.'],
            ['• DRAFT: Saves order as draft for review. Can be confirmed and dispatched later from Orders dashboard.'],
        ];

        const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
        wsInstructions['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 65 }];
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions & Status Guide');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    private autoDetectMapping(headers: string[]): Record<string, string> {
        const mapping: Record<string, string> = {};
        const cleanStr = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

        for (const [field, synonyms] of Object.entries(ORDER_HEADER_SYNONYMS)) {
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

    private mapRow(rawRow: Record<string, unknown>, mapping: Record<string, string>): OrderImportLineRow {
        const mapped: Partial<OrderImportLineRow> = {};

        // 1. Map via field -> rawHeader
        for (const [field, header] of Object.entries(mapping)) {
            if (!header || header === 'unmapped') continue;
            const val = rawRow[header];
            if (val === undefined || val === null || val === '') continue;

            const strVal = String(val).trim();
            if (field === 'quantity' || field === 'price' || field === 'discount' || field === 'taxRate') {
                const num = Number(strVal.replace(/[^0-9.-]+/g, ''));
                (mapped as any)[field] = isNaN(num) ? 0 : num;
            } else {
                (mapped as any)[field] = strVal;
            }
        }

        // 2. Direct field fallback
        for (const [key, val] of Object.entries(rawRow)) {
            if (val === undefined || val === null || val === '') continue;
            const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            for (const f of Object.keys(ORDER_HEADER_SYNONYMS)) {
                if (f.toLowerCase() === cleanKey && (mapped as any)[f] === undefined) {
                    const strVal = String(val).trim();
                    if (f === 'quantity' || f === 'price' || f === 'discount' || f === 'taxRate') {
                        const num = Number(strVal.replace(/[^0-9.-]+/g, ''));
                        (mapped as any)[f] = isNaN(num) ? 0 : num;
                    } else {
                        (mapped as any)[f] = strVal;
                    }
                }
            }
        }

        return mapped as OrderImportLineRow;
    }

    private cleanPhone(phone: string): string {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) return digits;
        if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
        if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
        return digits;
    }

    private normalizeOrderStatus(statusStr?: string): OrderStatus {
        if (!statusStr) return 'CONFIRMED';
        const upper = statusStr.toUpperCase().trim();
        if (upper === 'DRAFT') return 'DRAFT';
        if (upper === 'DELIVERED') return 'DELIVERED';
        if (upper === 'CANCELLED') return 'CANCELLED';
        return 'CONFIRMED';
    }
}
