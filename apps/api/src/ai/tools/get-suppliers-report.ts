import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createGetSuppliersTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_suppliers",
        description: "Get supplier information, purchase recommendations, and supplier performance.",
        schema: z.object({
            type: z.enum(['list', 'reorder_suggestions', 'performance']),
        }),
        func: (async ({ type }: any) => {
            if (type === 'list') {
                const suppliers = await prisma.supplier.findMany({
                    where: { orgId, isActive: true },
                    select: { name: true, contactPerson: true, phone: true, creditDays: true, leadTimeDays: true }
                });
                return JSON.stringify(suppliers);
            }

            if (type === 'performance') {
                const suppliers = await prisma.supplier.findMany({
                    where: { orgId },
                    select: { name: true, performanceScore: true, leadTimeDays: true }
                });
                return JSON.stringify(suppliers.sort((a, b) => b.performanceScore - a.performanceScore));
            }

            if (type === 'reorder_suggestions') {
                // Simplified suggestion logic based on minStockLevel
                const lowStock = await prisma.inventory.findMany({
                    where: { orgId },
                    include: { product: true },
                });

                const needed = lowStock
                    .filter(i => (i.quantity - i.reservedQty) <= (i.product.minStockLevel || 0))
                    .map(i => ({
                        productName: i.product.name,
                        currentStock: i.quantity - i.reservedQty,
                        suggestedReorder: i.product.minStockLevel * 2,
                    }));

                return JSON.stringify({
                    action: "Recommend creating Purchase Orders for these items",
                    items: needed.slice(0, 10)
                });
            }

            return "Invalid supplier query type.";
        }) as any,
    });
};

export const createRunReportTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "run_report",
        description: "Generate a specific business report like daily_summary, top_products, or gst_summary.",
        schema: z.object({
            reportType: z.enum(['daily_summary', 'weekly_summary', 'top_products', 'gst_summary']),
            period: z.string().optional(),
        }),
        func: (async ({ reportType }: any) => {
            let dateFilter = new Date();
            dateFilter.setHours(0, 0, 0, 0);

            if (reportType === 'daily_summary') {
                const todaySales = await prisma.order.aggregate({
                    where: { orgId, createdAt: { gte: dateFilter }, status: { in: ['DELIVERED', 'DISPATCHED'] } },
                    _sum: { netAmount: true },
                    _count: { id: true },
                });

                const collections = await prisma.payment.aggregate({
                    where: { orgId, createdAt: { gte: dateFilter } },
                    _sum: { amount: true },
                });

                return JSON.stringify({
                    reportName: "Daily Summary",
                    date: new Date().toISOString().split('T')[0],
                    totalSales: todaySales._sum.netAmount || 0,
                    ordersCount: todaySales._count.id || 0,
                    collections: collections._sum.amount || 0,
                });
            }

            if (reportType === 'top_products') {
                const top = await prisma.$queryRaw`
          SELECT p.name, SUM(oi.quantity) as qty, SUM(oi."totalAmount") as revenue
          FROM "OrderItem" oi
          JOIN "Order" o ON oi.order_id = o.id
          JOIN "Product" p ON oi.product_id = p.id
          WHERE o.org_id = ${orgId} AND o.status IN ('DELIVERED', 'DISPATCHED')
          GROUP BY p.name
          ORDER BY revenue DESC
          LIMIT 5
        `;
                return JSON.stringify(top, (key, value) => typeof value === 'bigint' ? Number(value) : value);
            }

            if (reportType === 'gst_summary') {
                const monthStart = new Date(dateFilter.getFullYear(), dateFilter.getMonth(), 1);
                const gst = await prisma.invoice.aggregate({
                    where: { orgId, invoiceDate: { gte: monthStart }, status: { not: 'DRAFT' } },
                    _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, totalAmount: true }
                });

                return JSON.stringify({
                    reportName: "MTD GST Summary",
                    periodStart: monthStart.toISOString().split('T')[0],
                    cgst: gst._sum.cgstAmount || 0,
                    sgst: gst._sum.sgstAmount || 0,
                    igst: gst._sum.igstAmount || 0,
                    cess: gst._sum.cessAmount || 0,
                    totalValue: gst._sum.totalAmount || 0,
                });
            }

            return "Report type not fully implemented yet.";
        }) as any,
    });
};
