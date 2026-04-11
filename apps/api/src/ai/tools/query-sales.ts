import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createQuerySalesTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "query_sales",
        description: "Get sales data aggregated by dimension for the organization.",
        schema: z.object({
            dimension: z.enum(['product', 'customer', 'salesman', 'category', 'day', 'week', 'month']),
            dateFrom: z.string().optional().describe("ISO date string (e.g., 2025-01-01)"),
            dateTo: z.string().optional().describe("ISO date string (e.g., 2025-12-31)"),
        }),
        func: (async ({ dimension, dateFrom, dateTo }: any) => {
            let whereClause: any = { orgId, status: { in: ['DELIVERED', 'DISPATCHED'] } };

            if (dateFrom || dateTo) {
                whereClause.createdAt = {};
                if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
                if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
            }

            if (dimension === 'customer') {
                const data = await prisma.order.groupBy({
                    by: ['customerId'],
                    where: whereClause,
                    _sum: { netAmount: true },
                    orderBy: { _sum: { netAmount: 'desc' } },
                    take: 10,
                });

                // Enrich with customer names
                const customerIds = data.map(d => d.customerId);
                const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
                const nameMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

                return JSON.stringify(data.map(d => ({
                    customerName: nameMap[d.customerId] || 'Unknown',
                    totalSales: d._sum.netAmount || 0
                })));
            }

            if (dimension === 'product') {
                const topProducts = await prisma.$queryRaw`
          SELECT p.name, SUM(oi.quantity) as quantity, SUM(oi."totalAmount") as revenue
          FROM "OrderItem" oi
          JOIN "Order" o ON oi."orderId" = o.id
          JOIN "Product" p ON oi."productId" = p.id
          WHERE o."orgId" = ${orgId} AND o.status IN ('DELIVERED', 'DISPATCHED')
          GROUP BY p.name
          ORDER BY revenue DESC
          LIMIT 10
        `;
                // Convert BigInts from raw query to numbers for JSON serialization
                return JSON.stringify(topProducts, (key, value) => typeof value === 'bigint' ? Number(value) : value);
            }

            if (dimension === 'day' || dimension === 'week' || dimension === 'month') {
                // We can do a raw query for date aggregation
                let dateTrunc = 'day';
                if (dimension === 'week') dateTrunc = 'week';
                if (dimension === 'month') dateTrunc = 'month';

                const raw = await prisma.$queryRawUnsafe(`
          SELECT DATE_TRUNC('${dateTrunc}', o."createdAt") as date, SUM(o."netAmount") as revenue
          FROM "Order" o
          WHERE o."orgId" = $1 AND o.status IN ('DELIVERED', 'DISPATCHED')
          GROUP BY DATE_TRUNC('${dateTrunc}', o."createdAt")
          ORDER BY date DESC
          LIMIT 30
        `, orgId);

                return JSON.stringify(raw, (key, value) => typeof value === 'bigint' ? Number(value) : value);
            }

            return "Dimension query partially implemented. Use customer, product, or day/week/month.";
        }) as any,
    });
};
