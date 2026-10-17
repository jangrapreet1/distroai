import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async getDashboard(orgId: string) {
        const cacheKey = `analytics:dashboard:${orgId}`;
        const cached = await this.redis.getJson<unknown>(cacheKey);
        if (cached) return cached;

        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            todayOrders, todayRevenue, monthOrders, monthRevenue,
            newCustomers, collections, topProducts, topCustomers, recentOrders,
            inventory, recentLocationUpdates, totalOutstanding, totalCredit,
            allOrdersAgg, confirmedOrdersAgg, dispatchedOrdersAgg, reconciledOrdersAgg,
            aiLatencyAgg, upiTotal, upiCompleted, customerRiskStats, highRiskCount
        ] = await Promise.all([
            this.prisma.order.count({ where: { orgId, createdAt: { gte: todayStart }, status: { not: 'CANCELLED' }, type: 'SALE' } }),
            this.prisma.order.aggregate({ where: { orgId, createdAt: { gte: todayStart }, status: { not: 'CANCELLED' }, type: 'SALE' }, _sum: { netAmount: true } }),
            this.prisma.order.count({ where: { orgId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' }, type: 'SALE' } }),
            this.prisma.order.aggregate({ where: { orgId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' }, type: 'SALE' }, _sum: { netAmount: true } }),
            this.prisma.customer.count({ where: { orgId, createdAt: { gte: monthStart } } }),
            this.prisma.payment.aggregate({ where: { orgId, createdAt: { gte: todayStart }, status: 'COMPLETED' }, _sum: { amount: true } }),
            this.prisma.orderItem.groupBy({ by: ['productId'], where: { order: { orgId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' }, type: 'SALE' } }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 5 }),
            this.prisma.customer.findMany({ where: { orgId }, orderBy: { outstandingAmount: 'desc' }, take: 5, select: { id: true, name: true, outstandingAmount: true, paymentScore: true } }),
            this.prisma.order.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 10, include: { customer: { select: { name: true } } } }),
            this.prisma.inventory.findMany({ where: { orgId }, select: { quantity: true, product: { select: { minStockLevel: true, purchasePrice: true, conversionFactor: true } } } }),
            this.prisma.locationRequest.findMany({ where: { orgId, status: 'COMPLETED' }, orderBy: { updatedAt: 'desc' }, take: 5, include: { customer: { select: { name: true } } } }),
            this.prisma.customer.aggregate({ where: { orgId, outstandingAmount: { gt: 0 } }, _sum: { outstandingAmount: true } }),
            this.prisma.customer.aggregate({ where: { orgId, outstandingAmount: { lt: 0 } }, _sum: { outstandingAmount: true } }),
            this.prisma.order.aggregate({ where: { orgId, status: { not: 'CANCELLED' }, type: 'SALE' }, _count: { id: true }, _sum: { netAmount: true } }),
            this.prisma.order.aggregate({ where: { orgId, status: { in: ['CONFIRMED', 'PACKED', 'DISPATCHED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'] }, type: 'SALE' }, _count: { id: true }, _sum: { netAmount: true } }),
            this.prisma.order.aggregate({ where: { orgId, status: { in: ['DISPATCHED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'] }, type: 'SALE' }, _count: { id: true }, _sum: { netAmount: true } }),
            this.prisma.order.aggregate({ where: { orgId, status: { in: ['DELIVERED', 'COMPLETED', 'DISPATCHED'] }, paidAmount: { gt: 0 }, type: 'SALE' }, _count: { id: true }, _sum: { paidAmount: true } }),
            this.prisma.aIQuery.aggregate({ where: { orgId, latencyMs: { not: null } }, _avg: { latencyMs: true } }),
            this.prisma.payment.count({ where: { orgId, method: 'UPI' } }),
            this.prisma.payment.count({ where: { orgId, method: 'UPI', status: 'COMPLETED' } }),
            this.prisma.customer.aggregate({ where: { orgId }, _avg: { paymentScore: true, avgDaysOverdue: true }, _sum: { creditLimit: true } }),
            this.prisma.customer.count({ where: { orgId, OR: [{ paymentScore: { lt: 60 } }, { overdue30: { gt: 0 } }] } }),
        ]);

        const lowStockCount = inventory.filter((i: any) => i.quantity <= i.product.minStockLevel).length;
        const totalInventoryValue = inventory.reduce((s: number, i: any) => {
            const factor = i.product.conversionFactor || 1;
            return s + ((i.quantity / factor) * i.product.purchasePrice);
        }, 0);

        // Enrich topProducts with product names
        const productIds = topProducts.map((p: any) => p.productId);
        const products = productIds.length > 0
            ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } })
            : [];
        const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));
        const enrichedTopProducts = topProducts.map((p: any) => ({
            ...p,
            productName: productMap.get(p.productId)?.name ?? 'Unknown',
            productSku: productMap.get(p.productId)?.sku ?? '',
        }));

        const funnel = {
            totalVisits: allOrdersAgg._count.id ?? 0,
            totalVisitsAmount: allOrdersAgg._sum.netAmount ?? 0,
            totalOrders: confirmedOrdersAgg._count.id ?? 0,
            totalOrdersAmount: confirmedOrdersAgg._sum.netAmount ?? 0,
            totalDispatched: dispatchedOrdersAgg._count.id ?? 0,
            totalDispatchedAmount: dispatchedOrdersAgg._sum.netAmount ?? 0,
            totalReconciled: reconciledOrdersAgg._count.id ?? 0,
            totalReconciledAmount: reconciledOrdersAgg._sum.paidAmount ?? 0,
            avgAiTranscriptionTime: aiLatencyAgg._avg.latencyMs ? Math.round((aiLatencyAgg._avg.latencyMs / 1000) * 10) / 10 : 0,
            upiInstantCaptureRate: upiTotal > 0 ? Math.round((upiCompleted / upiTotal) * 1000) / 10 : 100,
        };

        const creditRisk = {
            score: customerRiskStats._avg.paymentScore ? Math.round(customerRiskStats._avg.paymentScore) : 100,
            totalOutstanding: totalOutstanding._sum.outstandingAmount ?? 0,
            totalCreditLimit: customerRiskStats._sum.creditLimit ?? 0,
            highRiskCount,
            avgDsoDays: customerRiskStats._avg.avgDaysOverdue ? Math.round(customerRiskStats._avg.avgDaysOverdue) : 0,
        };

        const result = {
            today: { revenue: todayRevenue._sum.netAmount ?? 0, orders: todayOrders, collections: collections._sum.amount ?? 0, newCustomers: 0 },
            thisMonth: { revenue: monthRevenue._sum.netAmount ?? 0, orders: monthOrders, collections: 0, avgOrderValue: monthOrders > 0 ? (monthRevenue._sum.netAmount ?? 0) / monthOrders : 0, newCustomers },
            inventory: { lowStockCount, expiringCount: 0, totalValue: totalInventoryValue },
            collections: { totalOutstanding: totalOutstanding._sum.outstandingAmount ?? 0, totalCredit: Math.abs(totalCredit._sum.outstandingAmount ?? 0), overdueCount: 0, collectionRate: 0 },
            topProducts: enrichedTopProducts,
            topCustomers,
            recentOrders,
            recentLocationUpdates,
            alerts: [],
            funnel,
            creditRisk,
        };

        await this.redis.setJson(cacheKey, result, 300);
        return result;
    }

    async getSales(orgId: string, from: string, to: string, groupBy: string) {
        const where = { orgId, createdAt: { gte: new Date(from), lte: new Date(to) }, status: { not: 'CANCELLED' as const }, type: 'SALE' as const };
        const orders = await this.prisma.order.findMany({ where, include: { items: { include: { product: { select: { name: true, category: true, brand: true } } } }, customer: true, salesman: true } });

        const grouped = new Map<string, { label: string; revenue: number; orders: number }>();
        for (const order of orders) {
            if (groupBy === 'category' || groupBy === 'product') {
                const uniqueGroupsInOrder = new Set<string>();
                for (const item of order.items) {
                    const key = groupBy === 'category' ? (item.product?.category ?? 'Other') : (item.product?.name ?? 'Unknown');
                    const existing = grouped.get(key) ?? { label: key, revenue: 0, orders: 0 };
                    existing.revenue += item.totalAmount ?? 0;
                    if (!uniqueGroupsInOrder.has(key)) {
                        existing.orders++;
                        uniqueGroupsInOrder.add(key);
                    }
                    grouped.set(key, existing);
                }
            } else {
                let key: string;
                if (groupBy === 'customer') key = order.customer?.name ?? 'Unknown';
                else if (groupBy === 'region') key = order.customer?.city ?? 'Unknown';
                else if (groupBy === 'day') key = order.createdAt.toISOString().split('T')[0];
                else if (groupBy === 'week') {
                    const d = new Date(order.createdAt);
                    d.setDate(d.getDate() - d.getDay());
                    key = d.toISOString().split('T')[0];
                }
                else if (groupBy === 'month') key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
                else key = 'All';

                const existing = grouped.get(key) ?? { label: key, revenue: 0, orders: 0 };
                existing.revenue += order.netAmount;
                existing.orders++;
                grouped.set(key, existing);
            }
        }

        let data = Array.from(grouped.values());
        if (['customer', 'product', 'category', 'region'].includes(groupBy)) {
            data = data.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        }

        return { data, total: orders.reduce((s, o) => s + o.netAmount, 0) };
    }

    async getCollections(orgId: string, from: string, to: string) {
        const payments = await this.prisma.payment.findMany({
            where: { orgId, status: 'COMPLETED', createdAt: { gte: new Date(from), lte: new Date(to) } },
            include: { customer: { select: { id: true, name: true } } },
        });
        return {
            totalCollected: payments.reduce((s, p) => s + p.amount, 0),
            paymentCount: payments.length,
            byMethod: payments.reduce((acc: Record<string, number>, p) => { acc[p.method] = (acc[p.method] ?? 0) + p.amount; return acc; }, {}),
        };
    }
}
