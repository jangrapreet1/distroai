import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';

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
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    private async invalidateAnalytics(orgId: string) {
        await Promise.all([
            this.redis.del(`analytics:dashboard:${orgId}`),
            this.redis.del(`analytics:sales:${orgId}`),
        ]);
    }

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
        const po = await this.prisma.purchaseOrder.create({
            data: {
                orgId, supplierId: dto.supplierId, poNumber, totalAmount,
                expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
                notes: dto.notes,
                items: {
                    create: dto.items.map((i: any) => ({
                        productId: i.productId,
                        orderedQty: i.quantity,
                        receivedQty: 0,
                        deliveredQty: 0,
                        pendingQty: i.quantity,
                        returnedQty: 0,
                        cancelledQty: 0,
                        price: i.price,
                        taxRate: 0,
                        totalAmount: i.quantity * i.price,
                    })),
                },
            },
            include: { items: true },
        });

        await this.invalidateAnalytics(orgId);
        return po;
    }

    async findOne(orgId: string, id: string) {
        const po = await this.prisma.purchaseOrder.findFirst({
            where: { id, orgId },
            include: {
                items: { include: { product: { select: { name: true, sku: true, unit: true, conversionFactor: true, secondaryUnit: true } } } },
                supplier: true,
                expenses: { orderBy: { date: 'desc' } },
            },
        });
        if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase order not found' });
        return po;
    }

    async receive(orgId: string, id: string, dto: ReceivePODto, userId: string) {
        const po = await this.prisma.purchaseOrder.findFirst({
            where: { id, orgId },
            include: { items: { include: { product: true } } },
        });
        if (!po) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase order not found' });

        const result = await this.prisma.$transaction(async (tx: any) => {
            const defaultWh = await tx.warehouse.findFirst({ where: { orgId, isDefault: true } }) ||
                await tx.warehouse.findFirst({ where: { orgId } });

            let totalReceivedBatchValue = 0;

            for (const ri of dto.items) {
                const poItem = po.items.find((i: any) => i.id === ri.poItemId);
                if (!poItem || ri.receivedQty <= 0) continue;

                const currentPending = poItem.pendingQty > 0
                    ? poItem.pendingQty
                    : Math.max(0, poItem.orderedQty - poItem.receivedQty);

                if (ri.receivedQty > currentPending) {
                    throw new BadRequestException({
                        code: 'OVER_DELIVERY',
                        message: `Received quantity (${ri.receivedQty}) exceeds pending quantity (${currentPending}) for item ${poItem.id}`,
                    });
                }

                const newReceived = poItem.receivedQty + ri.receivedQty;
                const newPending = Math.max(0, poItem.orderedQty - newReceived - (poItem.cancelledQty || 0));

                await tx.purchaseOrderItem.update({
                    where: { id: ri.poItemId },
                    data: {
                        receivedQty: newReceived,
                        deliveredQty: newReceived,
                        pendingQty: newPending,
                    },
                });

                totalReceivedBatchValue += (ri.receivedQty * poItem.price);

                // Apply conversion factor for inventory
                const conversionFactor = poItem.product.conversionFactor || 1;
                const inventoryReceivedQty = ri.receivedQty * conversionFactor;

                const targetWarehouseId = defaultWh?.id || 'default';
                let inv = await tx.inventory.findFirst({ where: { orgId, productId: poItem.productId, warehouseId: targetWarehouseId } }) ||
                    await tx.inventory.findFirst({ where: { orgId, productId: poItem.productId } });

                if (!inv) {
                    inv = await tx.inventory.create({
                        data: {
                            orgId,
                            productId: poItem.productId,
                            warehouseId: targetWarehouseId,
                            quantity: 0,
                        },
                    });
                }

                await tx.inventory.update({
                    where: { id: inv.id },
                    data: { quantity: { increment: inventoryReceivedQty } },
                });

                await tx.inventoryTransaction.create({
                    data: {
                        inventoryId: inv.id,
                        type: 'IN',
                        quantity: inventoryReceivedQty,
                        referenceId: id,
                        referenceType: 'PURCHASE_ORDER',
                        createdBy: userId,
                        note: `GRN for PO ${po.poNumber}`,
                    },
                });

                if (ri.batchNumber && ri.expiryDate) {
                    await tx.productBatch.create({
                        data: {
                            productId: poItem.productId,
                            warehouseId: inv.warehouseId,
                            batchNumber: ri.batchNumber,
                            expiryDate: new Date(ri.expiryDate),
                            quantity: inventoryReceivedQty,
                            purchasePrice: poItem.price / conversionFactor,
                        },
                    });
                }
            }

            // Check if fully received across all line items
            const updatedItems = await tx.purchaseOrderItem.findMany({ where: { poId: id } });
            const allReceived = updatedItems.every((i: any) => {
                const ordered = i.orderedQty > 0 ? i.orderedQty : i.quantity;
                return (i.receivedQty || 0) + (i.cancelledQty || 0) >= ordered;
            });
            const newStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_DELIVERED';

            await tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: newStatus,
                    receivedDate: new Date(),
                },
            });

            // Update supplier profile: payable balance, lastDeliveryDate, fulfillment rate
            if (po.supplierId && totalReceivedBatchValue > 0) {
                const allSupplierItems = await tx.purchaseOrderItem.findMany({
                    where: { purchaseOrder: { orgId, supplierId: po.supplierId } },
                    select: { orderedQty: true, receivedQty: true },
                });

                const totalOrdered = allSupplierItems.reduce((s: number, it: any) => s + it.orderedQty, 0);
                const totalReceived = allSupplierItems.reduce((s: number, it: any) => s + it.receivedQty, 0);
                const fulfillmentRate = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 100;

                await tx.supplier.update({
                    where: { id: po.supplierId },
                    data: {
                        outstandingBalance: { increment: totalReceivedBatchValue },
                        lastDeliveryDate: new Date(),
                        fulfillmentRate,
                    },
                });
            }

            return { success: true, status: newStatus };
        });

        await this.invalidateAnalytics(orgId);
        return result;
    }
}
