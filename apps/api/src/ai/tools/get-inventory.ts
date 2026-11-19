import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createGetInventoryTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_inventory",
        description: "Get current inventory levels, low stock alerts, or expiring batches.",
        schema: z.object({
            filter: z.enum(['all', 'low_stock', 'expiring', 'out_of_stock']).optional().default('all').describe("Filter by stock status: all, low_stock, expiring, out_of_stock"),
            productId: z.string().optional().describe("Optional product UUID to filter by"),
        }),
        func: (async (args: any) => {
            const rawFilter = (args?.filter || args?.type || args?.status || 'all').toLowerCase();
            const filter = ['all', 'low_stock', 'expiring', 'out_of_stock'].includes(rawFilter) ? rawFilter : 'all';
            const productId = args?.productId || args?.id;

            let whereClause: any = { orgId };
            if (productId) whereClause.productId = productId;

            if (filter === 'all' || filter === 'out_of_stock') {
                if (filter === 'out_of_stock') {
                    whereClause.quantity = { lte: 0 };
                }
                const inv = await prisma.inventory.findMany({
                    where: whereClause,
                    include: { product: { select: { name: true, sku: true, sellingPrice: true, purchasePrice: true, unit: true } } },
                    take: 50,
                });
                return JSON.stringify(inv.map(i => ({
                    productName: i.product?.name || 'Unknown',
                    sku: i.product?.sku || '',
                    quantity: i.quantity,
                    reservedQty: i.reservedQty,
                    availableQty: i.quantity - i.reservedQty,
                    sellingPrice: i.product?.sellingPrice || 0,
                    purchasePrice: i.product?.purchasePrice || 0,
                    unit: i.product?.unit || 'unit',
                })));
            }

            if (filter === 'low_stock') {
                const inv = await prisma.inventory.findMany({
                    where: whereClause,
                    include: { product: true },
                });

                const lowStock = inv.filter(i => i.product && (i.quantity - i.reservedQty) <= (i.product.minStockLevel || 0));
                return JSON.stringify(lowStock.slice(0, 50).map(i => ({
                    productName: i.product?.name || 'Unknown',
                    sku: i.product?.sku || '',
                    availableQty: i.quantity - i.reservedQty,
                    minStockLevel: i.product?.minStockLevel || 0,
                    sellingPrice: i.product?.sellingPrice || 0,
                    purchasePrice: i.product?.purchasePrice || 0,
                    unit: i.product?.unit || 'unit',
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
                    include: { product: { select: { name: true, sku: true } } },
                    take: 50,
                });

                return JSON.stringify(batches.map(b => ({
                    productName: b.product?.name || 'Unknown',
                    sku: b.product?.sku || '',
                    batchNumber: b.batchNumber,
                    quantity: b.quantity,
                    expiryDate: b.expiryDate,
                })));
            }

            return JSON.stringify({ message: "No inventory items matched your criteria." });
        }) as any,
    });
};
