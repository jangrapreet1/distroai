import {
    Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { AiService } from '../ai/ai.service';
import { PLAN_LIMITS } from '../common/config/plan-limits.config';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto, ExpiringQueryDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
    private readonly logger = new Logger(ProductsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly aiService: AiService,
    ) { }

    private generateSku(brand?: string, category?: string): string {
        const b = (brand ?? 'GEN').substring(0, 3).toUpperCase();
        const c = (category ?? 'PRD').substring(0, 3).toUpperCase();
        const r = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${b}-${c}-${r}`;
    }

    async findAll(orgId: string, query: ListProductsQueryDto) {
        const { page = 1, limit = 20, search, category, brand, isActive, isDraft } = query;
        const cacheKey = `products:${orgId}:${JSON.stringify(query)}`;
        const cached = await this.redis.getJson<unknown>(cacheKey);
        if (cached) return cached;

        const where = {
            orgId,
            ...(isActive !== undefined && { isActive }),
            ...(isDraft !== undefined && { isDraft }),
            ...(category && { category }),
            ...(brand && { brand }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { sku: { contains: search, mode: 'insensitive' as const } },
                    { barcode: { contains: search, mode: 'insensitive' as const } },
                ],
            }),
        };

        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: {
                    inventories: { select: { quantity: true, reservedQty: true } },
                    variants: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            attributes: true,
                            sellingPrice: true,
                            mrp: true,
                            purchasePrice: true,
                            imageUrl: true,
                            isActive: true,
                            inventories: { select: { quantity: true, reservedQty: true } }
                        }
                    }
                },
                orderBy: { name: 'asc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        const data = products.map((p: any) => {
            let totalQuantity = p.inventories.reduce((s: number, i: any) => s + i.quantity, 0);
            let totalReserved = p.inventories.reduce((s: number, i: any) => s + i.reservedQty, 0);

            if (p.hasVariants && p.variants?.length > 0) {
                totalQuantity = p.variants.reduce((s: number, v: any) =>
                    s + (v.inventories?.reduce((vs: number, vi: any) => vs + vi.quantity, 0) ?? 0), 0);
                totalReserved = p.variants.reduce((s: number, v: any) =>
                    s + (v.inventories?.reduce((vs: number, vi: any) => vs + vi.reservedQty, 0) ?? 0), 0);
            }

            return {
                ...p,
                totalQuantity,
                totalReserved,
            };
        });

        const result = { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
        await this.redis.setJson(cacheKey, result, 30);
        return result;
    }

    async create(orgId: string, dto: CreateProductDto) {
        const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
        if (!org) throw new NotFoundException('Organization not found');
        const planKey = org.plan as keyof typeof PLAN_LIMITS;
        const currentCount = await this.prisma.product.count({ where: { orgId } });
        const limit = PLAN_LIMITS[planKey]?.maxProducts || 50;

        if (currentCount >= limit) {
            throw new BadRequestException({ code: 'PLAN_LIMIT_REACHED', message: `Your plan allows a maximum of ${limit} products.` });
        }

        const { initialQuantity, variants, ...productData } = dto;
        const sku = productData.sku?.trim() ? productData.sku.trim() : this.generateSku(productData.brand, productData.category);
        const isDraft = Boolean(dto.isDraft);
        const unit = productData.unit || 'Pieces';
        const sellingPrice = productData.sellingPrice !== undefined ? Number(productData.sellingPrice) : 0;
        const mrp = productData.mrp !== undefined ? Number(productData.mrp) : sellingPrice;
        const purchasePrice = productData.purchasePrice !== undefined ? Number(productData.purchasePrice) : 0;
        const gstRate = productData.gstRate !== undefined ? Number(productData.gstRate) : 0;

        const defaultWarehouse = await this.prisma.warehouse.findFirst({ where: { orgId, isDefault: true } });
        const hasVariants = Boolean(dto.hasVariants && Array.isArray(variants) && variants.length > 0);

        const product = await this.prisma.product.create({
            data: {
                orgId,
                ...productData,
                sku,
                unit,
                sellingPrice,
                mrp,
                purchasePrice,
                gstRate,
                isDraft,
                hasVariants,
                variantAttributes: dto.variantAttributes ? dto.variantAttributes : undefined,
                ...(defaultWarehouse && !hasVariants && {
                    inventories: { create: { orgId, warehouseId: defaultWarehouse.id, quantity: initialQuantity ?? 0 } },
                }),
                ...(hasVariants && defaultWarehouse && {
                    variants: {
                        create: variants!.map((v: any) => ({
                            orgId,
                            name: v.name,
                            sku: v.sku || `${sku}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                            barcode: v.barcode || null,
                            attributes: v.attributes || {},
                            sellingPrice: v.sellingPrice !== undefined ? Number(v.sellingPrice) : sellingPrice,
                            mrp: v.mrp !== undefined ? Number(v.mrp) : mrp,
                            purchasePrice: v.purchasePrice !== undefined ? Number(v.purchasePrice) : purchasePrice,
                            imageUrl: v.imageUrl || null,
                            isActive: v.isActive !== false,
                            inventories: {
                                create: {
                                    orgId,
                                    warehouseId: defaultWarehouse.id,
                                    quantity: Number(v.initialQuantity ?? 0),
                                }
                            }
                        }))
                    }
                }),
            },
            include: {
                variants: { include: { inventories: true } },
                inventories: true,
            }
        });

        await this.redis.del(`products:${orgId}:*`);

        // Dispatch to background AI embedding queue only for published products
        if (!isDraft) {
            this.aiService.generateAndSaveEmbedding(product.id).catch(err =>
                this.logger.error(`Failed to queue embedding for new product ${product.id}`, err)
            );
        }

        return product;
    }

    async bulkImport(orgId: string, fileBuffer: Buffer) {
        const wb = XLSX.read(fileBuffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        let created = 0, updated = 0, failed = 0;
        const errors: { row: number; error: string }[] = [];

        const defaultWarehouse = await this.prisma.warehouse.findFirst({ where: { orgId, isDefault: true } });

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                if (!row['name'] || !row['sellingPrice'] || !row['gstRate']) {
                    throw new Error('Missing required: name, sellingPrice, gstRate');
                }
                const sku = (row['sku'] as string) ?? this.generateSku(row['brand'] as string, row['category'] as string);
                const existing = await this.prisma.product.findFirst({ where: { orgId, sku } });

                if (existing) {
                    await this.prisma.product.update({
                        where: { id: existing.id },
                        data: {
                            name: row['name'] as string,
                            sellingPrice: Number(row['sellingPrice']),
                            purchasePrice: Number(row['purchasePrice'] ?? 0),
                            mrp: Number(row['mrp'] ?? row['sellingPrice']),
                            gstRate: Number(row['gstRate']),
                            category: row['category'] as string,
                            brand: row['brand'] as string,
                            hsnCode: row['hsnCode'] ? String(row['hsnCode']) : undefined,
                        },
                    });
                    this.aiService.generateAndSaveEmbedding(existing.id).catch(() => { });
                    updated++;
                } else {
                    const newProduct = await this.prisma.product.create({
                        data: {
                            orgId, sku, name: row['name'] as string,
                            sellingPrice: Number(row['sellingPrice']),
                            purchasePrice: Number(row['purchasePrice'] ?? 0),
                            mrp: Number(row['mrp'] ?? row['sellingPrice']),
                            gstRate: Number(row['gstRate']),
                            unit: (row['unit'] as string) ?? 'Pieces',
                            category: row['category'] as string,
                            brand: row['brand'] as string,
                            hsnCode: row['hsnCode'] ? String(row['hsnCode']) : undefined,
                            ...(defaultWarehouse && {
                                inventories: { create: { orgId, warehouseId: defaultWarehouse.id, quantity: 0 } },
                            }),
                        },
                    });
                    this.aiService.generateAndSaveEmbedding(newProduct.id).catch(() => { });
                    created++;
                }
            } catch (err) {
                failed++;
                errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Unknown error' });
            }
        }

        return { created, updated, failed, errors };
    }

    async findOne(orgId: string, id: string) {
        const product = await this.prisma.product.findFirst({
            where: { id, orgId },
            include: {
                inventories: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
                variants: {
                    include: {
                        inventories: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                batches: { orderBy: { expiryDate: 'asc' } },
            },
        });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });

        let totalQuantity = product.inventories.reduce((s: number, i: any) => s + i.quantity, 0);
        let totalReserved = product.inventories.reduce((s: number, i: any) => s + i.reservedQty, 0);

        if (product.hasVariants && product.variants?.length > 0) {
            totalQuantity = product.variants.reduce((s: number, v: any) =>
                s + (v.inventories?.reduce((vs: number, vi: any) => vs + vi.quantity, 0) ?? 0), 0);
            totalReserved = product.variants.reduce((s: number, v: any) =>
                s + (v.inventories?.reduce((vs: number, vi: any) => vs + vi.reservedQty, 0) ?? 0), 0);
        }

        return {
            ...product,
            totalQuantity,
            totalReserved,
        };
    }

    async update(orgId: string, id: string, dto: UpdateProductDto) {
        const product = await this.prisma.product.findFirst({ where: { id, orgId } });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });

        const { variants, ...updateData } = dto;

        // Upsert variants if provided
        if (Array.isArray(variants)) {
            const defaultWarehouse = await this.prisma.warehouse.findFirst({ where: { orgId, isDefault: true } })
                || await this.prisma.warehouse.findFirst({ where: { orgId } });
            for (const v of variants) {
                if (v.id) {
                    await this.prisma.productVariant.update({
                        where: { id: v.id },
                        data: {
                            name: v.name,
                            sku: v.sku,
                            barcode: v.barcode !== undefined ? v.barcode : undefined,
                            attributes: v.attributes,
                            sellingPrice: v.sellingPrice !== undefined ? Number(v.sellingPrice) : undefined,
                            mrp: v.mrp !== undefined ? Number(v.mrp) : undefined,
                            purchasePrice: v.purchasePrice !== undefined ? Number(v.purchasePrice) : undefined,
                            imageUrl: v.imageUrl,
                            isActive: v.isActive !== undefined ? v.isActive : true,
                        },
                    });

                    // Update variant inventory if stock is provided
                    const targetStock = v.stock !== undefined ? Number(v.stock) : (v.quantity !== undefined ? Number(v.quantity) : (v.initialQuantity !== undefined ? Number(v.initialQuantity) : undefined));
                    if (targetStock !== undefined && !isNaN(targetStock)) {
                        const existingVarInv = await this.prisma.variantInventory.findFirst({
                            where: { orgId, variantId: v.id },
                        });
                        if (existingVarInv) {
                            await this.prisma.variantInventory.update({
                                where: { id: existingVarInv.id },
                                data: { quantity: Math.max(0, targetStock) },
                            });
                        } else if (defaultWarehouse) {
                            await this.prisma.variantInventory.create({
                                data: {
                                    orgId,
                                    variantId: v.id,
                                    warehouseId: defaultWarehouse.id,
                                    quantity: Math.max(0, targetStock),
                                },
                            });
                        }
                    }
                } else if (v.name) {
                    const newSku = v.sku || `${product.sku}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                    const targetStock = v.stock !== undefined ? Number(v.stock) : (v.quantity !== undefined ? Number(v.quantity) : (v.initialQuantity !== undefined ? Number(v.initialQuantity) : 0));
                    await this.prisma.productVariant.create({
                        data: {
                            orgId,
                            productId: id,
                            name: v.name,
                            sku: newSku,
                            barcode: v.barcode || null,
                            attributes: v.attributes || {},
                            sellingPrice: v.sellingPrice !== undefined ? Number(v.sellingPrice) : product.sellingPrice,
                            mrp: v.mrp !== undefined ? Number(v.mrp) : product.mrp,
                            purchasePrice: v.purchasePrice !== undefined ? Number(v.purchasePrice) : product.purchasePrice,
                            imageUrl: v.imageUrl || null,
                            isActive: v.isActive !== false,
                            ...(defaultWarehouse && {
                                inventories: {
                                    create: {
                                        orgId,
                                        warehouseId: defaultWarehouse.id,
                                        quantity: Math.max(0, Number(targetStock || 0)),
                                    },
                                },
                            }),
                        },
                    });
                }
            }
        }

        const updated = await this.prisma.product.update({
            where: { id },
            data: updateData,
            include: {
                variants: { include: { inventories: true } },
                inventories: true,
            },
        });

        await this.redis.del(`products:${orgId}:*`);

        if (dto.name || dto.description || dto.category || dto.brand) {
            this.aiService.generateAndSaveEmbedding(id).catch(err =>
                this.logger.error(`Failed to queue embedding update for product ${id}`, err)
            );
        }

        return updated;
    }

    async remove(orgId: string, id: string) {
        const product = await this.prisma.product.findFirst({ where: { id, orgId } });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });
        return this.prisma.product.update({ where: { id }, data: { isActive: false } });
    }

    async restore(orgId: string, id: string) {
        const product = await this.prisma.product.findFirst({ where: { id, orgId } });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });
        return this.prisma.product.update({ where: { id }, data: { isActive: true } });
    }

    async hardDelete(orgId: string, id: string) {
        const product = await this.prisma.product.findFirst({ 
            where: { id, orgId },
            include: {
                orderItems: { select: { id: true }, take: 1 },
                poItems: { select: { id: true }, take: 1 },
                invoiceItems: { select: { id: true }, take: 1 },
            }
        });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });
        
        if (product.orderItems.length > 0 || product.poItems.length > 0 || product.invoiceItems.length > 0) {
            throw new BadRequestException({ 
                code: 'HAS_HISTORY', 
                message: 'Cannot permanently delete this product because it has associated orders or invoices. Please keep it archived instead.' 
            });
        }

        return this.prisma.product.delete({ where: { id } });
    }

    async publish(orgId: string, id: string) {
        const product = await this.prisma.product.findFirst({ where: { id, orgId } });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });

        const updated = await this.prisma.product.update({
            where: { id },
            data: {
                isDraft: false,
                isActive: true,
            },
            include: {
                variants: { include: { inventories: true } },
                inventories: true,
            },
        });

        await this.redis.del(`products:${orgId}:*`);

        // Queue vector embedding now that product is published
        this.aiService.generateAndSaveEmbedding(id).catch(err =>
            this.logger.error(`Failed to queue embedding for published product ${id}`, err)
        );

        return updated;
    }

    async getLowStock(orgId: string) {
        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true, isDraft: false },
            include: { inventories: { select: { quantity: true } } },
        });

        return products
            .map((p: any) => ({
                ...p,
                currentQty: p.inventories.reduce((s: number, i: any) => s + i.quantity, 0),
                deficit: Math.max(0, p.minStockLevel - p.inventories.reduce((s: number, i: any) => s + i.quantity, 0)),
            }))
            .filter((p: any) => p.currentQty <= p.minStockLevel);
    }

    async getExpiring(orgId: string, query: ExpiringQueryDto) {
        const days = query.days ?? 30;
        const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        const batches = await this.prisma.productBatch.findMany({
            where: { expiryDate: { lte: cutoff }, product: { orgId, isActive: true, isDraft: false } },
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { expiryDate: 'asc' },
        });

        return batches.map((b: any) => ({
            ...b,
            daysRemaining: b.expiryDate
                ? Math.ceil((b.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
        }));
    }
}
