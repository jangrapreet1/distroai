import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createGetSuppliersTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_suppliers",
        description: "Get supplier/vendor information, purchase orders, vendor ledger/financial history, payment dues, reorder recommendations, and supplier performance.",
        schema: z.object({
            type: z.enum(['list', 'profile', 'financial_history', 'reorder_suggestions', 'performance']).describe("Query type: 'financial_history' for purchase orders and payables, 'profile' for supplier contact/details, 'list' for all suppliers, 'performance' for rankings, 'reorder_suggestions' for low stock reordering."),
            supplierName: z.string().optional().describe("Name of the supplier to look up (e.g. 'Ronak', 'Puneet')"),
            supplierId: z.string().optional().describe("Optional ID of the supplier if known"),
        }),
        func: (async ({ type, supplierName, supplierId }: any) => {
            if (type === 'profile' || type === 'financial_history') {
                let whereClause: any = { orgId };
                if (supplierId) {
                    whereClause.id = supplierId;
                } else if (supplierName) {
                    whereClause.OR = [
                        { name: { contains: supplierName.trim(), mode: 'insensitive' } },
                        { contactPerson: { contains: supplierName.trim(), mode: 'insensitive' } },
                    ];
                }

                const supplier = await prisma.supplier.findFirst({
                    where: whereClause,
                    include: {
                        purchaseOrders: {
                            orderBy: { createdAt: 'desc' },
                            take: 20,
                            include: {
                                items: {
                                    include: { product: { select: { name: true, sku: true } } }
                                }
                            }
                        }
                    }
                });

                if (!supplier) {
                    const allSuppliers = await prisma.supplier.findMany({
                        where: { orgId, isActive: true },
                        select: { name: true, phone: true }
                    });
                    return JSON.stringify({
                        error: `Supplier "${supplierName || supplierId}" not found in system.`,
                        availableSuppliers: allSuppliers.map(s => s.name)
                    });
                }

                const totalPurchased = supplier.purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
                const totalPaid = supplier.purchaseOrders.reduce((sum, po) => sum + (po.paidAmount || 0), 0);
                const totalDue = totalPurchased - totalPaid;

                return JSON.stringify({
                    supplierId: supplier.id,
                    name: supplier.name,
                    contactPerson: supplier.contactPerson,
                    phone: supplier.phone,
                    email: supplier.email,
                    gstNumber: supplier.gstNumber,
                    address: supplier.address,
                    creditDays: supplier.creditDays,
                    leadTimeDays: supplier.leadTimeDays,
                    performanceScore: supplier.performanceScore,
                    outstandingBalance: supplier.outstandingBalance,
                    totalPurchasesAmount: totalPurchased,
                    totalPaidAmount: totalPaid,
                    calculatedDueAmount: totalDue,
                    totalPurchaseOrders: supplier.purchaseOrders.length,
                    recentPurchaseOrders: supplier.purchaseOrders.map(po => ({
                        poNumber: po.poNumber,
                        date: po.createdAt.toISOString().split('T')[0],
                        status: po.status,
                        paymentStatus: po.paymentStatus,
                        totalAmount: po.totalAmount,
                        paidAmount: po.paidAmount,
                        dueAmount: (po.totalAmount || 0) - (po.paidAmount || 0),
                        itemsCount: po.items.length,
                        items: po.items.map(it => ({
                            productName: it.product?.name || 'Item',
                            sku: it.product?.sku || '',
                            orderedQty: it.orderedQty,
                            price: it.price,
                            total: it.orderedQty * it.price,
                        }))
                    }))
                });
            }

            if (type === 'list') {
                const suppliers = await prisma.supplier.findMany({
                    where: { orgId, isActive: true },
                    select: {
                        id: true,
                        name: true,
                        contactPerson: true,
                        phone: true,
                        outstandingBalance: true,
                        creditDays: true,
                        leadTimeDays: true,
                        performanceScore: true,
                        _count: { select: { purchaseOrders: true } }
                    }
                });
                return JSON.stringify(suppliers);
            }

            if (type === 'performance') {
                const suppliers = await prisma.supplier.findMany({
                    where: { orgId },
                    select: { name: true, performanceScore: true, leadTimeDays: true, outstandingBalance: true }
                });
                return JSON.stringify(suppliers.sort((a, b) => b.performanceScore - a.performanceScore));
            }

            if (type === 'reorder_suggestions') {
                // Suggestion logic based on minStockLevel
                const lowStock = await prisma.inventory.findMany({
                    where: { orgId },
                    include: { product: true },
                });

                const needed = lowStock
                    .filter(i => i.product && (i.quantity - i.reservedQty) <= (i.product.minStockLevel || 0))
                    .map(i => ({
                        productName: i.product?.name || 'Unknown',
                        sku: i.product?.sku || '',
                        currentStock: i.quantity - i.reservedQty,
                        suggestedReorder: (i.product?.minStockLevel || 10) * 2,
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
          JOIN "Order" o ON oi."orderId" = o.id
          JOIN "Product" p ON oi."productId" = p.id
          WHERE o."orgId" = ${orgId} AND o.status IN ('DELIVERED', 'DISPATCHED')
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
