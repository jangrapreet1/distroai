import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createGetInventoryTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_inventory",
        description: "Get current inventory levels, low stock alerts, or expiring batches.",
        schema: z.object({
            filter: z.enum(['all', 'low_stock', 'expiring', 'out_of_stock']),
            productId: z.string().optional(),
        }),
        func: (async ({ filter, productId }: any) => {
            let whereClause: any = { orgId };
            if (productId) whereClause.productId = productId;

            if (filter === 'all' || filter === 'out_of_stock') {
                if (filter === 'out_of_stock') {
                    whereClause.quantity = { lte: 0 };
                }
                const inv = await prisma.inventory.findMany({
                    where: whereClause,
                    include: { product: { select: { name: true, sku: true } } },
                    take: 20,
                });
                return JSON.stringify(inv.map(i => ({
                    productName: i.product.name,
                    sku: i.product.sku,
                    quantity: i.quantity,
                    reservedQty: i.reservedQty,
                })));
            }

            if (filter === 'low_stock') {
                const inv = await prisma.inventory.findMany({
                    where: whereClause,
                    include: { product: true },
                });

                const lowStock = inv.filter(i => (i.quantity - i.reservedQty) <= i.product.minStockLevel);
                return JSON.stringify(lowStock.slice(0, 20).map(i => ({
                    productName: i.product.name,
                    sku: i.product.sku,
                    availableQty: i.quantity - i.reservedQty,
                    minStockLevel: i.product.minStockLevel,
                })));
            }

            if (filter === 'expiring') {
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

                const batches = await prisma.productBatch.findMany({
                    where: {
                        warehouse: { orgId },
                        quantity: { gt: 0 },
                        expiryDate: { lte: thirtyDaysFromNow }
                    },
                    include: { product: { select: { name: true } } },
                    take: 20,
                });

                return JSON.stringify(batches.map(b => ({
                    productName: b.product.name,
                    batchNumber: b.batchNumber,
                    quantity: b.quantity,
                    expiryDate: b.expiryDate,
                })));
            }

            return "Invalid filter provided.";
        }) as any,
    });
};
