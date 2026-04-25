import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';

class POItemDto {
    @IsString() productId!: string;
    @IsNumber() @Min(1) quantity!: number;
    @IsString() unit!: string;
    @IsNumber() @Min(0) price!: number;
}

export class CreatePurchaseOrderDto {
    @IsString() supplierId!: string;
    @IsOptional() @IsString() warehouseId?: string;
    @IsOptional() @IsDateString() expectedDate?: string;
    @IsArray() @ValidateNested({ each: true }) @Type(() => POItemDto) items!: POItemDto[];
    @IsOptional() @IsString() notes?: string;
}

class ReceiveItemDto {
    @IsString() poItemId!: string;
    @IsNumber() @Min(0) receivedQty!: number;
    @IsOptional() @IsString() batchNumber?: string;
    @IsOptional() @IsString() expiryDate?: string;
}

export class ReceivePODto {
    @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveItemDto) items!: ReceiveItemDto[];
}

@Injectable()
export class PurchaseOrdersService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(orgId: string, page = 1, limit = 20) {
        const [data, total] = await Promise.all([
            this.prisma.purchaseOrder.findMany({ where: { orgId }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { supplier: { select: { name: true } }, _count: { select: { items: true } } } }),
            this.prisma.purchaseOrder.count({ where: { orgId } }),
        ]);
        return { data, meta: { total, page, limit } };
    }

    async create(orgId: string, dto: CreatePurchaseOrderDto, userId: string) {
        const count = await this.prisma.purchaseOrder.count({ where: { orgId } });
        const settings = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        const poNumber = `${settings?.poPrefix ?? 'PO'}-${String(count + 1).padStart(5, '0')}`;

        const totalAmount = dto.items.reduce((s: number, i: any) => s + i.quantity * i.price, 0);
        return this.prisma.purchaseOrder.create({
            data: {
                orgId, supplierId: dto.supplierId, poNumber, totalAmount,
                expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
                notes: dto.notes,
                items: { create: dto.items.map((i: any) => ({ productId: i.productId, orderedQty: i.quantity, price: i.price, taxRate: 0, totalAmount: i.quantity * i.price })) },
            },
            include: { items: true },
        });
    }

    async findOne(orgId: string, id: string) {
        const po = await this.prisma.purchaseOrder.findFirst({
            where: { id, orgId },
            include: {
                items: { include: { product: { select: { name: true, sku: true } } } },
                supplier: true,
                expenses: { orderBy: { date: 'desc' } },
            },
        });
        if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase order not found' });
        return po;
    }

    async receive(orgId: string, id: string, dto: ReceivePODto, userId: string) {
        const po = await this.prisma.purchaseOrder.findFirst({ where: { id, orgId }, include: { items: { include: { product: true } } } });
        if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase order not found' });

        return this.prisma.$transaction(async (tx: any) => {
            for (const ri of dto.items) {
                const poItem = po.items.find((i: any) => i.id === ri.poItemId);
                if (!poItem || ri.receivedQty === 0) continue;

                // Update PO Item with raw ordered units
                await tx.purchaseOrderItem.update({ where: { id: ri.poItemId }, data: { receivedQty: { increment: ri.receivedQty } } });

                // Apply conversion factor for inventory
                const conversionFactor = poItem.product.conversionFactor || 1;
                const inventoryReceivedQty = ri.receivedQty * conversionFactor;

                let inv = await tx.inventory.findFirst({ where: { orgId, productId: poItem.productId } });
                if (!inv) {
                    inv = await tx.inventory.create({ data: { orgId, productId: poItem.productId, warehouseId: dto.items[0]?.batchNumber ?? '', quantity: 0 } });
                }

                await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: inventoryReceivedQty } } });
                await tx.inventoryTransaction.create({ data: { inventoryId: inv.id, type: 'IN', quantity: inventoryReceivedQty, referenceId: id, referenceType: 'PURCHASE_ORDER', createdBy: userId } });

                if (ri.batchNumber && ri.expiryDate) {
                    await tx.productBatch.create({ data: { productId: poItem.productId, warehouseId: inv.warehouseId, batchNumber: ri.batchNumber, expiryDate: new Date(ri.expiryDate), quantity: inventoryReceivedQty, purchasePrice: poItem.price / conversionFactor } });
                }
            }

            // Check if fully received
            const updated = await tx.purchaseOrderItem.findMany({ where: { poId: id } });
            const allReceived = updated.every((i: any) => i.receivedQty >= i.orderedQty);
            if (allReceived) {
                await tx.purchaseOrder.update({ where: { id }, data: { status: 'RECEIVED' } });
            } else {
                await tx.purchaseOrder.update({ where: { id }, data: { status: 'ACKNOWLEDGED' } });
            }

            return { success: true };
        });
    }
}
