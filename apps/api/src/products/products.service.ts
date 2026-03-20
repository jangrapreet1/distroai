import {
    Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto, ExpiringQueryDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
    private readonly logger = new Logger(ProductsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    private generateSku(brand?: string, category?: string): string {
        const b = (brand ?? 'GEN').substring(0, 3).toUpperCase();
        const c = (category ?? 'PRD').substring(0, 3).toUpperCase();
        const r = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${b}-${c}-${r}`;
    }

    async findAll(orgId: string, query: ListProductsQueryDto) {
        const { page = 1, limit = 20, search, category, brand, isActive = true } = query;
        const cacheKey = `products:${orgId}:${JSON.stringify(query)}`;
        const cached = await this.redis.getJson<unknown>(cacheKey);
        if (cached) return cached;

        const where = {
            orgId, isActive,
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
                include: { inventories: { select: { quantity: true, reservedQty: true } } },
                orderBy: { name: 'asc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        const data = products.map((p: any) => ({
            ...p,
            totalQuantity: p.inventories.reduce((s: number, i: any) => s + i.quantity, 0),
            totalReserved: p.inventories.reduce((s: number, i: any) => s + i.reservedQty, 0),
        }));

        const result = { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
        await this.redis.setJson(cacheKey, result, 30);
        return result;
    }

    async create(orgId: string, dto: CreateProductDto) {
        const sku = dto.sku ?? this.generateSku(dto.brand, dto.category);

        const defaultWarehouse = await this.prisma.warehouse.findFirst({ where: { orgId, isDefault: true } });

        const product = await this.prisma.product.create({
            data: {
                orgId, ...dto, sku,
                ...(defaultWarehouse && {
                    inventories: { create: { orgId, warehouseId: defaultWarehouse.id, quantity: 0 } },
                }),
            },
        });

        await this.redis.del(`products:${orgId}:*`);
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
                        },
                    });
                    updated++;
                } else {
                    await this.prisma.product.create({
                        data: {
                            orgId, sku, name: row['name'] as string,
                            sellingPrice: Number(row['sellingPrice']),
                            purchasePrice: Number(row['purchasePrice'] ?? 0),
                            mrp: Number(row['mrp'] ?? row['sellingPrice']),
                            gstRate: Number(row['gstRate']),
                            unit: (row['unit'] as string) ?? 'Pieces',
                            category: row['category'] as string,
                            brand: row['brand'] as string,
                            ...(defaultWarehouse && {
                                inventories: { create: { orgId, warehouseId: defaultWarehouse.id, quantity: 0 } },
                            }),
                        },
                    });
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
                batches: { orderBy: { expiryDate: 'asc' } },
            },
        });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });
        return {
            ...product,
            totalQuantity: product.inventories.reduce((s: number, i: any) => s + i.quantity, 0),
            totalReserved: product.inventories.reduce((s: number, i: any) => s + i.reservedQty, 0),
        };
    }

    async update(orgId: string, id: string, dto: UpdateProductDto) {
        const product = await this.prisma.product.findFirst({ where: { id, orgId } });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });
        const updated = await this.prisma.product.update({ where: { id }, data: dto });
        return updated;
    }

    async remove(orgId: string, id: string) {
        const product = await this.prisma.product.findFirst({ where: { id, orgId } });
        if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found' });
        return this.prisma.product.update({ where: { id }, data: { isActive: false } });
    }

    async getLowStock(orgId: string) {
        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true },
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
            where: { expiryDate: { lte: cutoff }, product: { orgId, isActive: true } },
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
