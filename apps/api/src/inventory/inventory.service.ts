import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustInventoryDto, TransferInventoryDto, ListTransactionsQueryDto, InventoryQueryDto, CreateWarehouseDto, UpdateWarehouseDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async findAll(orgId: string, query: InventoryQueryDto) {
        const inventories = await this.prisma.inventory.findMany({
            where: { orgId, ...(query.warehouseId && { warehouseId: query.warehouseId }) },
            include: {
                product: { select: { id: true, name: true, sku: true, unit: true, minStockLevel: true, sellingPrice: true, purchasePrice: true } },
                warehouse: { select: { id: true, name: true, code: true } },
            },
        });

        const grouped = new Map<string, typeof inventories>();
        for (const inv of inventories) {
            const list = grouped.get(inv.productId) ?? [];
            list.push(inv);
            grouped.set(inv.productId, list);
        }

        const result = Array.from(grouped.values()).map((invs: any[]) => ({
            product: invs[0].product,
            warehouses: invs.map((i: any) => ({
                warehouse: i.warehouse,
                quantity: i.quantity,
                reservedQty: i.reservedQty,
                availableQty: i.quantity - i.reservedQty,
            })),
            totalQty: invs.reduce((s: number, i: any) => s + i.quantity, 0),
        }));

        if (query.lowStockOnly) {
            return result.filter((r: any) => r.totalQty <= (r.product.minStockLevel ?? 0));
        }
        return result;
    }

    async getWarehouses(orgId: string) {
        return this.prisma.warehouse.findMany({ where: { orgId } });
    }

    async createWarehouse(orgId: string, dto: CreateWarehouseDto) {
        if (dto.isDefault) {
            await this.prisma.warehouse.updateMany({ where: { orgId }, data: { isDefault: false } });
        }
        return this.prisma.warehouse.create({
            data: { ...dto, orgId }
        });
    }

    async updateWarehouse(orgId: string, warehouseId: string, dto: UpdateWarehouseDto) {
        const wh = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, orgId } });
        if (!wh) throw new NotFoundException('Warehouse not found');

        if (dto.isDefault) {
            await this.prisma.warehouse.updateMany({ where: { orgId }, data: { isDefault: false } });
        }
        return this.prisma.warehouse.update({
            where: { id: warehouseId },
            data: dto
        });
    }

    async adjust(orgId: string, dto: AdjustInventoryDto, userId: string) {
        const inventory = await this.prisma.inventory.findFirst({
            where: { orgId, productId: dto.productId, warehouseId: dto.warehouseId },
        });

        if (!inventory) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Inventory record not found' });

        const newQty = inventory.quantity + dto.quantity;
        if (newQty < 0) throw new BadRequestException({ code: 'CONFLICT', message: 'Adjustment would result in negative stock' });

        const tx = await this.prisma.$transaction([
            this.prisma.inventory.update({
                where: { id: inventory.id },
                data: { quantity: newQty },
            }),
            this.prisma.inventoryTransaction.create({
                data: {
                    inventoryId: inventory.id,
                    type: 'ADJUSTMENT',
                    quantity: dto.quantity,
                    note: dto.reason,
                    createdBy: userId,
                },
            }),
        ]);

        return tx;
    }

    async transfer(orgId: string, dto: TransferInventoryDto, userId: string) {
        const source = await this.prisma.inventory.findFirst({
            where: { orgId, productId: dto.productId, warehouseId: dto.fromWarehouseId },
        });
        if (!source) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Source inventory not found' });

        const available = source.quantity - source.reservedQty;
        if (available < dto.quantity) {
            throw new BadRequestException({ code: 'CONFLICT', message: `Only ${available} units available (excluding reserved)` });
        }

        let dest = await this.prisma.inventory.findFirst({
            where: { orgId, productId: dto.productId, warehouseId: dto.toWarehouseId },
        });

        return this.prisma.$transaction(async (tx: any) => {
            await tx.inventory.update({ where: { id: source.id }, data: { quantity: { decrement: dto.quantity } } });

            if (!dest) {
                dest = await tx.inventory.create({ data: { orgId, productId: dto.productId, warehouseId: dto.toWarehouseId, quantity: dto.quantity } });
            } else {
                await tx.inventory.update({ where: { id: dest.id }, data: { quantity: { increment: dto.quantity } } });
            }

            await tx.inventoryTransaction.createMany({
                data: [
                    { inventoryId: source.id, type: 'TRANSFER', quantity: -dto.quantity, referenceType: 'TRANSFER', note: `Transfer to WH ${dto.toWarehouseId}`, createdBy: userId },
                    { inventoryId: dest!.id, type: 'IN', quantity: dto.quantity, referenceType: 'TRANSFER', note: `Transfer from WH ${dto.fromWarehouseId}`, createdBy: userId },
                ],
            });

            return { success: true, transferred: dto.quantity };
        });
    }

    async getTransactions(orgId: string, query: ListTransactionsQueryDto) {
        const { page = 1, limit = 20, productId, warehouseId, type, dateFrom, dateTo } = query;
        const where = {
            inventory: {
                orgId,
                ...(productId && { productId }),
                ...(warehouseId && { warehouseId }),
            },
            ...(type && { type: type as 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' }),
            ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
            ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
        };

        const [data, total] = await Promise.all([
            this.prisma.inventoryTransaction.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: {
                    inventory: {
                        include: {
                            product: { select: { name: true, sku: true } },
                            warehouse: { select: { name: true, code: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.inventoryTransaction.count({ where }),
        ]);

        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async getValuation(orgId: string) {
        const inventories = await this.prisma.inventory.findMany({
            where: { orgId },
            include: {
                product: { select: { purchasePrice: true, sellingPrice: true } },
                warehouse: { select: { id: true, name: true } },
            },
        });

        const warehouseMap = new Map<string, { warehouseId: string; warehouseName: string; totalValue: number; productCount: number }>();
        let totalUnits = 0;

        for (const inv of inventories) {
            const pp = inv.product.sellingPrice || inv.product.purchasePrice || 0;
            const value = inv.quantity * pp;
            totalUnits += inv.quantity;
            const existing = warehouseMap.get(inv.warehouseId);
            if (existing) {
                existing.totalValue += value;
                existing.productCount++;
            } else {
                warehouseMap.set(inv.warehouseId, { warehouseId: inv.warehouseId, warehouseName: inv.warehouse.name, totalValue: value, productCount: 1 });
            }
        }

        const rows = Array.from(warehouseMap.values());
        const grandTotal = rows.reduce((s, r) => s + r.totalValue, 0);
        return { warehouses: rows, grandTotal, totalUnits };
    }
}
