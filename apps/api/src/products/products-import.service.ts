import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../common/services/redis.service';
import { parseBufferToWorkbook } from '../common/utils/import-buffer.util';

export interface ProductImportRow {
    name: string;
    parentSku?: string;
    variantName?: string;
    variantSku?: string;
    category?: string;
    brand?: string;
    hsnCode?: string;
    gstRate: number;
    cessRate?: number;
    purchasePrice?: number;
    sellingPrice: number;
    mrp?: number;
    unit?: string;
    openingStock?: number;
    minStockLevel?: number;
}

export interface ProductImportOptions {
    updateExisting?: boolean;
    createOpeningStock?: boolean;
}

export interface ProductValidationResult {
    rowIndex: number;
    data: ProductImportRow;
    isValid: boolean;
    isExisting: boolean;
    hasVariant: boolean;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
}

const PRODUCT_HEADER_SYNONYMS: Record<keyof ProductImportRow, string[]> = {
    name: ['name', 'product name', 'item name', 'particulars', 'description', 'item', 'item description', 'goods', 'material'],
    parentSku: ['parent sku', 'parent code', 'item code', 'code', 'product code', 'sku', 'part no', 'item no'],
    variantName: ['variant', 'variant name', 'variation', 'size', 'pack size', 'pack', 'weight', 'color', 'type', 'specification'],
    variantSku: ['variant sku', 'variant code', 'sub sku', 'child sku'],
    category: ['category', 'group', 'item group', 'product group', 'class'],
    brand: ['brand', 'company', 'manufacturer', 'make', 'mfg'],
    hsnCode: ['hsn', 'hsn code', 'hsn/sac', 'sac', 'tariff code'],
    gstRate: ['gst', 'gst rate', 'gst %', 'tax rate', 'tax %', 'tax', 'igst', 'gst slab', 'gst rate %'],
    cessRate: ['cess', 'cess rate', 'cess %'],
    purchasePrice: ['purchase price', 'cost price', 'buy rate', 'purchase rate', 'cp', 'cost', 'buy price', 'purchase cost'],
    sellingPrice: ['selling price', 'sale rate', 'price', 'rate', 'sp', 'unit price', 'sales price', 'selling rate'],
    mrp: ['mrp', 'maximum retail price', 'retail price', 'print price'],
    unit: ['unit', 'uom', 'measuring unit', 'base unit', 'unit of measure'],
    openingStock: ['opening stock', 'stock', 'quantity', 'qty', 'opening qty', 'balance', 'closing stock', 'on hand', 'available'],
    minStockLevel: ['min stock', 'minimum stock', 'reorder level', 'min qty', 'safety stock', 'reorder point', 'min stock level'],
};

@Injectable()
export class ProductsImportService {
    private readonly logger = new Logger(ProductsImportService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly redis: RedisService,
    ) { }

    private round2(n: number): number {
        return Math.round(n * 100) / 100;
    }

    private normalizeHeader(header: string): string {
        return header.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    private detectColumnMapping(headers: string[]): Record<keyof ProductImportRow, string | null> {
        const mapping: Record<keyof ProductImportRow, string | null> = {
            name: null,
            parentSku: null,
            variantName: null,
            variantSku: null,
            category: null,
            brand: null,
            hsnCode: null,
            gstRate: null,
            cessRate: null,
            purchasePrice: null,
            sellingPrice: null,
            mrp: null,
            unit: null,
            openingStock: null,
            minStockLevel: null,
        };

        const normalizedHeaders = headers.map(h => ({ original: h, norm: this.normalizeHeader(h) }));

        for (const [field, synonyms] of Object.entries(PRODUCT_HEADER_SYNONYMS)) {
            for (const h of normalizedHeaders) {
                if (synonyms.includes(h.norm)) {
                    mapping[field as keyof ProductImportRow] = h.original;
                    break;
                }
            }
        }

        return mapping;
    }

    /**
     * Parse uploaded Excel/CSV buffer, detect columns, and validate rows.
     */
    async parseProductExcel(orgId: string, fileBuffer: Buffer) {
        let wb: XLSX.WorkBook;
        try {
            wb = await parseBufferToWorkbook(fileBuffer);
        } catch {
            throw new BadRequestException({ code: 'INVALID_FILE', message: 'Unable to parse file. Please upload a valid .xlsx, .xls, .csv, .docx, or .txt file.' });
        }

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new BadRequestException({ code: 'EMPTY_WORKBOOK', message: 'The uploaded file contains no sheets.' });
        }

        const targetSheetName = wb.SheetNames.find(s =>
            s.toLowerCase().includes('product') ||
            s.toLowerCase().includes('item') ||
            s.toLowerCase().includes('stock') ||
            s.toLowerCase().includes('data')
        ) || wb.SheetNames.find(s =>
            !s.toLowerCase().includes('instruction') &&
            !s.toLowerCase().includes('help')
        ) || wb.SheetNames[0];

        const ws = wb.Sheets[targetSheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rawJson.length < 2) {
            throw new BadRequestException({ code: 'NO_DATA', message: 'The selected sheet contains no data rows.' });
        }

        // Header detection
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
            const rowStr = rawJson[i].map((c: any) => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('name') || rowStr.includes('item') || rowStr.includes('product') || rowStr.includes('rate') || rowStr.includes('price')) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = (rawJson[headerRowIndex] || []).map((h: any) => String(h).trim()).filter(Boolean);
        const dataRows = rawJson.slice(headerRowIndex + 1);
        const mapping = this.detectColumnMapping(headers);

        // Fetch existing products in this org to check for updates
        const existingProducts = await this.prisma.product.findMany({
            where: { orgId },
            select: { id: true, sku: true, name: true },
        });
        const existingSkuSet = new Set(existingProducts.map(p => p.sku.toLowerCase().trim()));
        const existingNameSet = new Set(existingProducts.map(p => p.name.toLowerCase().trim()));

        const validationResults: ProductValidationResult[] = [];

        for (let idx = 0; idx < dataRows.length; idx++) {
            const rawRow = dataRows[idx];
            // Skip empty rows
            if (!rawRow || rawRow.every((val: any) => val === '' || val === null || val === undefined)) {
                continue;
            }

            const getVal = (field: keyof ProductImportRow): any => {
                const headerName = mapping[field];
                if (!headerName) return undefined;
                const colIdx = headers.indexOf(headerName);
                if (colIdx === -1) return undefined;
                return rawRow[colIdx];
            };

            const errors: { field: string; message: string }[] = [];
            const warnings: { field: string; message: string }[] = [];

            // 1. Name
            const name = String(getVal('name') || '').trim();
            if (!name) {
                errors.push({ field: 'name', message: 'Product Name is required' });
            }

            // 2. Selling Price
            const rawSellingPrice = getVal('sellingPrice');
            let sellingPrice = Number(rawSellingPrice);
            if (rawSellingPrice === undefined || rawSellingPrice === '' || isNaN(sellingPrice)) {
                errors.push({ field: 'sellingPrice', message: 'Selling Price is required and must be a number' });
                sellingPrice = 0;
            } else if (sellingPrice < 0) {
                errors.push({ field: 'sellingPrice', message: 'Selling Price cannot be negative' });
            }

            // 3. Purchase Price
            const rawPurchasePrice = getVal('purchasePrice');
            let purchasePrice = 0;
            if (rawPurchasePrice !== undefined && rawPurchasePrice !== '') {
                purchasePrice = Number(rawPurchasePrice);
                if (isNaN(purchasePrice) || purchasePrice < 0) {
                    warnings.push({ field: 'purchasePrice', message: 'Invalid purchase price, defaulting to 0' });
                    purchasePrice = 0;
                }
            }

            // 4. MRP
            const rawMrp = getVal('mrp');
            let mrp = sellingPrice;
            if (rawMrp !== undefined && rawMrp !== '') {
                const parsedMrp = Number(rawMrp);
                if (!isNaN(parsedMrp) && parsedMrp >= 0) {
                    mrp = parsedMrp;
                }
            }

            // 5. GST Rate
            const rawGst = getVal('gstRate');
            let gstRate = 0;
            if (rawGst !== undefined && rawGst !== '') {
                // handle percentage signs e.g. "18%"
                const cleanGst = String(rawGst).replace('%', '').trim();
                gstRate = Number(cleanGst);
                if (isNaN(gstRate) || gstRate < 0) {
                    errors.push({ field: 'gstRate', message: 'GST Rate must be a valid percentage (0, 5, 12, 18, 28)' });
                    gstRate = 0;
                } else if (![0, 5, 12, 18, 28].includes(gstRate)) {
                    warnings.push({ field: 'gstRate', message: `GST Rate ${gstRate}% is non-standard (typical: 0, 5, 12, 18, 28)` });
                }
            } else {
                warnings.push({ field: 'gstRate', message: 'GST Rate not provided, defaulting to 0%' });
            }

            // 6. Cess Rate
            const rawCess = getVal('cessRate');
            let cessRate = 0;
            if (rawCess !== undefined && rawCess !== '') {
                const cleanCess = String(rawCess).replace('%', '').trim();
                cessRate = Number(cleanCess);
                if (isNaN(cessRate) || cessRate < 0) cessRate = 0;
            }

            // 7. Opening Stock
            const rawStock = getVal('openingStock');
            let openingStock = 0;
            if (rawStock !== undefined && rawStock !== '') {
                const parsedStock = Number(rawStock);
                if (isNaN(parsedStock) || parsedStock < 0) {
                    warnings.push({ field: 'openingStock', message: 'Invalid opening stock quantity, defaulting to 0' });
                } else {
                    openingStock = Math.round(parsedStock);
                }
            }

            // 8. Min Stock Level
            const rawMinStock = getVal('minStockLevel');
            let minStockLevel = 0;
            if (rawMinStock !== undefined && rawMinStock !== '') {
                const parsedMin = Number(rawMinStock);
                if (!isNaN(parsedMin) && parsedMin >= 0) {
                    minStockLevel = Math.round(parsedMin);
                }
            }

            const parentSku = String(getVal('parentSku') || '').trim();
            const variantName = String(getVal('variantName') || '').trim();
            const variantSku = String(getVal('variantSku') || '').trim();
            const category = String(getVal('category') || '').trim() || undefined;
            const brand = String(getVal('brand') || '').trim() || undefined;
            const hsnCode = String(getVal('hsnCode') || '').trim() || undefined;
            const unit = String(getVal('unit') || '').trim() || 'Pieces';

            // Check if existing product
            const isExisting = (parentSku && existingSkuSet.has(parentSku.toLowerCase())) ||
                existingNameSet.has(name.toLowerCase());

            const rowData: ProductImportRow = {
                name,
                parentSku: parentSku || undefined,
                variantName: variantName || undefined,
                variantSku: variantSku || undefined,
                category,
                brand,
                hsnCode,
                gstRate,
                cessRate: cessRate || undefined,
                purchasePrice,
                sellingPrice,
                mrp,
                unit,
                openingStock,
                minStockLevel,
            };

            validationResults.push({
                rowIndex: idx + 1,
                data: rowData,
                isValid: errors.length === 0,
                isExisting,
                hasVariant: Boolean(variantName),
                errors,
                warnings,
            });
        }

        const validCount = validationResults.filter(r => r.isValid).length;
        const invalidCount = validationResults.length - validCount;

        return {
            totalRows: validationResults.length,
            validCount,
            invalidCount,
            mapping,
            headers,
            validationResults,
        };
    }

    /**
     * Transactional execution of Product and Variant upsert, opening inventory, and transactions.
     */
    async executeProductImport(orgId: string, rows: ProductImportRow[], options: ProductImportOptions = {}) {
        const updateExisting = options.updateExisting ?? true;
        const createOpeningStock = options.createOpeningStock ?? true;

        const defaultWarehouse = await this.prisma.warehouse.findFirst({
            where: { orgId, isDefault: true },
        }) || await this.prisma.warehouse.findFirst({
            where: { orgId },
        });

        if (!defaultWarehouse && createOpeningStock) {
            throw new BadRequestException({ code: 'NO_WAREHOUSE', message: 'No warehouse found in your organization to assign opening stock.' });
        }

        // Group rows by Parent Product (Key: Parent SKU if available, else lowercased Product Name)
        const productGroups = new Map<string, ProductImportRow[]>();
        for (const row of rows) {
            const groupKey = (row.parentSku ? row.parentSku.toLowerCase().trim() : row.name.toLowerCase().trim());
            if (!productGroups.has(groupKey)) {
                productGroups.set(groupKey, []);
            }
            productGroups.get(groupKey)!.push(row);
        }

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        const errors: { name: string; error: string }[] = [];
        const affectedProductIds: string[] = [];

        for (const [groupKey, groupRows] of productGroups.entries()) {
            try {
                const firstRow = groupRows[0];
                const hasVariants = groupRows.length > 1 || groupRows.some(r => Boolean(r.variantName));

                // Generate SKU if missing
                const baseSku = firstRow.parentSku || this.generateSku(firstRow.name, firstRow.brand);

                await this.prisma.$transaction(async (tx) => {
                    // Check if parent product already exists
                    let product = await tx.product.findFirst({
                        where: {
                            orgId,
                            OR: [
                                { sku: baseSku },
                                { name: { equals: firstRow.name, mode: 'insensitive' } },
                            ],
                        },
                        include: { variants: true },
                    });

                    let isUpdate = false;

                    if (product) {
                        if (!updateExisting) {
                            return; // skip if user chose not to update
                        }
                        isUpdate = true;
                        // Update existing parent product
                        product = await tx.product.update({
                            where: { id: product.id },
                            data: {
                                name: firstRow.name,
                                category: firstRow.category || product.category,
                                brand: firstRow.brand || product.brand,
                                hsnCode: firstRow.hsnCode || product.hsnCode,
                                gstRate: firstRow.gstRate ?? product.gstRate,
                                cessRate: firstRow.cessRate ?? product.cessRate,
                                unit: firstRow.unit || product.unit,
                                minStockLevel: firstRow.minStockLevel ?? product.minStockLevel,
                                hasVariants,
                                updatedAt: new Date(),
                            },
                            include: { variants: true },
                        });
                        updatedCount++;
                    } else {
                        // Create brand new product
                        product = await tx.product.create({
                            data: {
                                orgId,
                                name: firstRow.name,
                                sku: baseSku,
                                category: firstRow.category,
                                brand: firstRow.brand,
                                hsnCode: firstRow.hsnCode,
                                gstRate: firstRow.gstRate ?? 0,
                                cessRate: firstRow.cessRate ?? 0,
                                purchasePrice: firstRow.purchasePrice ?? 0,
                                sellingPrice: firstRow.sellingPrice,
                                mrp: firstRow.mrp ?? firstRow.sellingPrice,
                                unit: firstRow.unit || 'Pieces',
                                minStockLevel: firstRow.minStockLevel ?? 0,
                                hasVariants,
                            },
                            include: { variants: true },
                        });
                        createdCount++;
                    }

                    affectedProductIds.push(product.id);

                    if (hasVariants) {
                        let primaryVariantSet = false;

                        for (let vIdx = 0; vIdx < groupRows.length; vIdx++) {
                            const vRow = groupRows[vIdx];
                            const variantName = vRow.variantName || `Pack ${vIdx + 1}`;
                            const variantSku = vRow.variantSku || `${baseSku}-V${vIdx + 1}`;

                            // Check if variant exists
                            let variant = product.variants.find(
                                v => v.sku.toLowerCase() === variantSku.toLowerCase() ||
                                     v.name.toLowerCase() === variantName.toLowerCase()
                            );

                            if (variant) {
                                variant = await tx.productVariant.update({
                                    where: { id: variant.id },
                                    data: {
                                        name: variantName,
                                        purchasePrice: vRow.purchasePrice ?? variant.purchasePrice,
                                        sellingPrice: vRow.sellingPrice ?? variant.sellingPrice,
                                        mrp: vRow.mrp ?? variant.mrp,
                                        updatedAt: new Date(),
                                    },
                                });
                            } else {
                                variant = await tx.productVariant.create({
                                    data: {
                                        orgId,
                                        productId: product.id,
                                        name: variantName,
                                        sku: variantSku,
                                        attributes: { "Size/Pack": variantName },
                                        purchasePrice: vRow.purchasePrice ?? 0,
                                        sellingPrice: vRow.sellingPrice,
                                        mrp: vRow.mrp ?? vRow.sellingPrice,
                                    },
                                });
                            }

                            // Sync base product prices with primary variant
                            if (!primaryVariantSet) {
                                await tx.product.update({
                                    where: { id: product.id },
                                    data: {
                                        sellingPrice: variant.sellingPrice ?? vRow.sellingPrice,
                                        purchasePrice: variant.purchasePrice ?? vRow.purchasePrice ?? 0,
                                        mrp: variant.mrp ?? vRow.mrp ?? vRow.sellingPrice,
                                    },
                                });
                                primaryVariantSet = true;
                            }

                            // Opening stock for variant
                            if (createOpeningStock && defaultWarehouse && (vRow.openingStock ?? 0) > 0) {
                                const stockQty = vRow.openingStock!;
                                const existingVarInv = await tx.variantInventory.findFirst({
                                    where: { variantId: variant.id, warehouseId: defaultWarehouse.id },
                                });

                                if (existingVarInv) {
                                    await tx.variantInventory.update({
                                        where: { id: existingVarInv.id },
                                        data: { quantity: existingVarInv.quantity + stockQty },
                                    });
                                } else {
                                    await tx.variantInventory.create({
                                        data: {
                                            orgId,
                                            variantId: variant.id,
                                            warehouseId: defaultWarehouse.id,
                                            quantity: stockQty,
                                        },
                                    });
                                }
                            }
                        }
                    } else {
                        // Flat product without variants
                        await tx.product.update({
                            where: { id: product.id },
                            data: {
                                sellingPrice: firstRow.sellingPrice,
                                purchasePrice: firstRow.purchasePrice ?? 0,
                                mrp: firstRow.mrp ?? firstRow.sellingPrice,
                            },
                        });

                        // Opening stock for flat product
                        if (createOpeningStock && defaultWarehouse && (firstRow.openingStock ?? 0) > 0) {
                            const stockQty = firstRow.openingStock!;
                            const existingInv = await tx.inventory.findFirst({
                                where: { productId: product.id, warehouseId: defaultWarehouse.id },
                            });

                            if (existingInv) {
                                await tx.inventory.update({
                                    where: { id: existingInv.id },
                                    data: { quantity: existingInv.quantity + stockQty },
                                });
                                await tx.inventoryTransaction.create({
                                    data: {
                                        inventoryId: existingInv.id,
                                        type: 'ADJUSTMENT',
                                        quantity: stockQty,
                                        referenceType: 'IMPORT',
                                        note: 'Opening stock imported from spreadsheet',
                                    },
                                });
                            } else {
                                const newInv = await tx.inventory.create({
                                    data: {
                                        orgId,
                                        productId: product.id,
                                        warehouseId: defaultWarehouse.id,
                                        quantity: stockQty,
                                    },
                                });
                                await tx.inventoryTransaction.create({
                                    data: {
                                        inventoryId: newInv.id,
                                        type: 'ADJUSTMENT',
                                        quantity: stockQty,
                                        referenceType: 'IMPORT',
                                        note: 'Opening stock imported from spreadsheet',
                                    },
                                });
                            }
                        }
                    }
                });
            } catch (err: any) {
                failedCount++;
                errors.push({
                    name: groupRows[0]?.name || groupKey,
                    error: err.message || 'Failed to import product group',
                });
                this.logger.error(`Import error for product ${groupKey}:`, err);
            }
        }

        // Trigger AI embeddings in background
        for (const prodId of affectedProductIds) {
            this.aiService.generateAndSaveEmbedding(prodId).catch(() => {});
        }

        // Invalidate Redis caches
        try {
            await this.redis.del(`products:${orgId}:*`);
            await this.redis.del(`analytics:${orgId}:*`);
        } catch {}

        return {
            totalProcessed: productGroups.size,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            errors,
        };
    }

    /**
     * Generate sample formatted Excel file (.xlsx) with realistic multi-row variants and instructions.
     */
    generateProductTemplate(): Buffer {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Products Data
        const sampleRows = [
            {
                'Product Name*': 'Roff Tile Adhesive',
                'Parent SKU': 'ROFF-TA',
                'Variant Name / Size': '20 Kg Bag',
                'Category': 'Adhesives',
                'Brand': 'Pidilite',
                'HSN Code': '350691',
                'GST Rate %*': 18,
                'Purchase Price': 240,
                'Selling Price*': 360,
                'MRP': 420,
                'Unit': 'Bags',
                'Opening Stock': 150,
                'Min Stock': 20,
            },
            {
                'Product Name*': 'Roff Tile Adhesive',
                'Parent SKU': 'ROFF-TA',
                'Variant Name / Size': '50 Kg Bag',
                'Category': 'Adhesives',
                'Brand': 'Pidilite',
                'HSN Code': '350691',
                'GST Rate %*': 18,
                'Purchase Price': 380,
                'Selling Price*': 560,
                'MRP': 650,
                'Unit': 'Bags',
                'Opening Stock': 80,
                'Min Stock': 10,
            },
            {
                'Product Name*': 'UltraTech Super Cement',
                'Parent SKU': 'UT-SUP',
                'Variant Name / Size': '',
                'Category': 'Cement',
                'Brand': 'UltraTech',
                'HSN Code': '252329',
                'GST Rate %*': 28,
                'Purchase Price': 310,
                'Selling Price*': 380,
                'MRP': 410,
                'Unit': 'Bags',
                'Opening Stock': 300,
                'Min Stock': 50,
            },
        ];

        const wsProducts = XLSX.utils.json_to_sheet(sampleRows);
        wsProducts['!cols'] = [
            { wch: 26 }, // Product Name
            { wch: 14 }, // Parent SKU
            { wch: 20 }, // Variant Name / Size
            { wch: 16 }, // Category
            { wch: 16 }, // Brand
            { wch: 12 }, // HSN Code
            { wch: 12 }, // GST Rate %
            { wch: 15 }, // Purchase Price
            { wch: 15 }, // Selling Price
            { wch: 12 }, // MRP
            { wch: 10 }, // Unit
            { wch: 14 }, // Opening Stock
            { wch: 12 }, // Min Stock
        ];

        XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

        // Sheet 2: Instructions
        const instructions = [
            { 'Rule': 'Product Variations', 'Description': 'To add variations (e.g. 20kg, 50kg), repeat the exact same Product Name across multiple rows with different Variant Name / Size, prices, and stock.' },
            { 'Rule': 'Mandatory Fields', 'Description': 'Product Name, Selling Price, and GST Rate % are mandatory. If GST Rate is 0, enter 0.' },
            { 'Rule': 'Supported Units', 'Description': 'Pieces, Bags, Boxes, Litres, Kg, Metres, Packets, Dozens, Sets.' },
            { 'Rule': 'GST Slabs', 'Description': 'Standard GST slabs in India: 0%, 5%, 12%, 18%, 28%.' },
            { 'Rule': 'Opening Stock', 'Description': 'Stock entered here will automatically be credited to your Default Warehouse upon import.' },
        ];
        const wsInstructions = XLSX.utils.json_to_sheet(instructions);
        wsInstructions['!cols'] = [{ wch: 22 }, { wch: 90 }];
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    private generateSku(name: string, brand?: string): string {
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
        const cleanBrand = brand ? brand.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) : 'GEN';
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `${cleanBrand}-${cleanName}-${rand}`;
    }
}
