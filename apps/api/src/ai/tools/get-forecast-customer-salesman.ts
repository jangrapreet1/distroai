import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createGetForecastTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_forecast",
        description: "Get demand forecast and reorder recommendations for products.",
        schema: z.object({
            productId: z.string().optional(),
            type: z.enum(['specific', 'reorder_list']),
        }),
        func: (async ({ productId, type }: any) => {
            if (type === 'specific') {
                if (!productId) return "productId is required for 'specific' type.";

                const forecasts = await prisma.demandForecast.findMany({
                    where: { orgId, productId, forecastDate: { gte: new Date() } },
                    orderBy: { forecastDate: 'asc' },
                    take: 30, // next 30 days
                });

                if (forecasts.length === 0) return "No forecast data available for this product.";

                const totalForecast = forecasts.reduce((sum, f) => sum + f.predictedQty, 0);
                return JSON.stringify({
                    productId,
                    thirtyDayForecast: totalForecast,
                    dailyBreakdown: forecasts.map(f => ({
                        date: f.forecastDate.toISOString().split('T')[0],
                        qty: f.predictedQty
                    }))
                });
            }

            if (type === 'reorder_list') {
                // Real implementation would look at inventory vs reorder points
                // Simplified query for AI tool context
                const lowStock = await prisma.inventory.findMany({
                    where: { orgId },
                    include: { product: true },
                });

                const recommendations = lowStock
                    .filter(i => (i.quantity - i.reservedQty) <= (i.product.minStockLevel || 0))
                    .map(i => ({
                        productName: i.product.name,
                        currentStock: i.quantity - i.reservedQty,
                        minStock: i.product.minStockLevel,
                        recommendedReorderQty: i.product.minStockLevel * 2, // simplified logic
                    }))
                    .sort((a, b) => a.currentStock - b.currentStock)
                    .slice(0, 10);

                return JSON.stringify(recommendations);
            }

            return "Invalid type requested.";
        }) as any,
    });
};

export const createGetCustomerTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_customer",
        description: "Get detailed information about a specific customer, top customers, or dormant customers.",
        schema: z.object({
            customerId: z.string().optional(),
            customerName: z.string().optional().describe("Used for fuzzy matching if ID is unknown"),
            type: z.enum(['profile', 'top_customers', 'dormant', 'high_risk']),
        }),
        func: (async ({ customerId, customerName, type }: any) => {
            if (type === 'profile') {
                if (!customerId && !customerName) return "Must provide customerId or customerName for profile lookup.";

                let customer;
                if (customerId) {
                    customer = await prisma.customer.findUnique({ where: { id: customerId } });
                } else if (customerName) {
                    customer = await prisma.customer.findFirst({
                        where: { orgId, name: { contains: customerName, mode: 'insensitive' } }
                    });
                }

                if (!customer) return "Customer not found.";
                return JSON.stringify(customer);
            }

            if (type === 'top_customers') {
                const top = await prisma.customer.findMany({
                    where: { orgId },
                    orderBy: { paymentScore: 'desc' }, // proxy for top customers in this snippet
                    take: 10,
                    select: { name: true, phone: true, paymentScore: true, creditLimit: true }
                });
                return JSON.stringify(top);
            }

            if (type === 'dormant') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const dormant = await prisma.customer.findMany({
                    where: { orgId, lastOrderDate: { lt: thirtyDaysAgo } },
                    orderBy: { lastOrderDate: 'asc' },
                    take: 10,
                    select: { name: true, phone: true, lastOrderDate: true, paymentScore: true }
                });
                return JSON.stringify(dormant);
            }

            if (type === 'high_risk') {
                const risk = await prisma.customer.findMany({
                    where: { orgId, paymentScore: { lt: 50 }, outstandingAmount: { gt: 0 } },
                    orderBy: { paymentScore: 'asc' },
                    take: 10,
                    select: { name: true, phone: true, paymentScore: true, outstandingAmount: true }
                });
                return JSON.stringify(risk);
            }

            return "Invalid type or missing parameters.";
        }) as any,
    });
};

export const createGetSalesmanTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_salesman",
        description: "Get field force performance data like visits, orders, and collections.",
        schema: z.object({
            salesmanId: z.string().optional(),
            period: z.enum(['today', 'week', 'month']),
            metric: z.enum(['visits', 'orders', 'collections', 'all']),
        }),
        func: (async ({ salesmanId, period, metric }: any) => {
            let dateFilter = new Date();
            dateFilter.setHours(0, 0, 0, 0); // start of today

            if (period === 'week') {
                dateFilter.setDate(dateFilter.getDate() - 7);
            } else if (period === 'month') {
                dateFilter.setDate(dateFilter.getDate() - 30);
            }

            let whereClause: any = { salesman: { orgId }, createdAt: { gte: dateFilter } };
            if (salesmanId) whereClause.salesmanId = salesmanId;

            // Visits
            let visitsCount = 0;
            if (metric === 'visits' || metric === 'all') {
                visitsCount = await prisma.fieldVisit.count({ where: whereClause });
            }

            // Orders (amount and count)
            let orders: any = { _sum: { netAmount: 0 }, _count: { id: 0 } };
            if (metric === 'orders' || metric === 'all') {
                whereClause.orgId = orgId; // Order table has orgId
                orders = await prisma.order.aggregate({
                    where: whereClause,
                    _sum: { netAmount: true },
                    _count: { id: true }
                });
            }

            // Collections
            let collections: any = { _sum: { amount: 0 } };
            if (metric === 'collections' || metric === 'all') {
                // Payment table format
                collections = await prisma.payment.aggregate({
                    where: { orgId, salesmanId, createdAt: { gte: dateFilter } } as any, // salesmanId might not be on payment directly, using simplified logic
                    _sum: { amount: true }
                });
            }

            return JSON.stringify({
                period,
                visits: visitsCount,
                orderValue: orders._sum.netAmount || 0,
                orderCount: orders._count.id || 0,
                collections: collections._sum.amount || 0,
            });
        }) as any,
    });
};
