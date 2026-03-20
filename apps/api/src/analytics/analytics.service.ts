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
            inventory, recentLocationUpdates
        ] = await Promise.all([
            this.prisma.order.count({ where: { orgId, createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } } }),
            this.prisma.order.aggregate({ where: { orgId, createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } }, _sum: { netAmount: true } }),
            this.prisma.order.count({ where: { orgId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } } }),
            this.prisma.order.aggregate({ where: { orgId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } }, _sum: { netAmount: true } }),
            this.prisma.customer.count({ where: { orgId, createdAt: { gte: monthStart } } }),
            this.prisma.payment.aggregate({ where: { orgId, createdAt: { gte: todayStart }, status: 'COMPLETED' }, _sum: { amount: true } }),
            this.prisma.orderItem.groupBy({ by: ['productId'], where: { order: { orgId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } } }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 5 }),
            this.prisma.customer.findMany({ where: { orgId }, orderBy: { outstandingAmount: 'desc' }, take: 5, select: { id: true, name: true, outstandingAmount: true, paymentScore: true } }),
            this.prisma.order.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 10, include: { customer: { select: { name: true } } } }),
            this.prisma.inventory.findMany({ where: { orgId }, include: { product: { select: { minStockLevel: true, purchasePrice: true, conversionFactor: true } } } }),
            this.prisma.locationRequest.findMany({ where: { orgId, status: 'COMPLETED' }, orderBy: { updatedAt: 'desc' }, take: 5, include: { customer: { select: { name: true } } } }),
        ]);

        const lowStockCount = inventory.filter((i: any) => i.quantity <= i.product.minStockLevel).length;
        const totalInventoryValue = inventory.reduce((s: number, i: any) => {
            const factor = i.product.conversionFactor || 1;
            return s + ((i.quantity / factor) * i.product.purchasePrice);
        }, 0);
        const totalOutstanding = await this.prisma.customer.aggregate({ where: { orgId }, _sum: { outstandingAmount: true } });

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

        const result = {
            today: { revenue: todayRevenue._sum.netAmount ?? 0, orders: todayOrders, collections: collections._sum.amount ?? 0, newCustomers: 0 },
            thisMonth: { revenue: monthRevenue._sum.netAmount ?? 0, orders: monthOrders, collections: 0, avgOrderValue: monthOrders > 0 ? (monthRevenue._sum.netAmount ?? 0) / monthOrders : 0, newCustomers },
            inventory: { lowStockCount, expiringCount: 0, totalValue: totalInventoryValue },
            collections: { totalOutstanding: totalOutstanding._sum.outstandingAmount ?? 0, overdueCount: 0, collectionRate: 0 },
            topProducts: enrichedTopProducts,
            topCustomers,
            recentOrders,
            recentLocationUpdates,
            alerts: [],
        };

        await this.redis.setJson(cacheKey, result, 300);
        return result;
    }

    async getSales(orgId: string, from: string, to: string, groupBy: string) {
        const where = { orgId, createdAt: { gte: new Date(from), lte: new Date(to) }, status: { not: 'CANCELLED' as const } };
        const orders = await this.prisma.order.findMany({ where, include: { items: { include: { product: { select: { category: true, brand: true } } } }, customer: true, salesman: true } });

        const grouped = new Map<string, { label: string; revenue: number; orders: number }>();
        for (const order of orders) {
            let key: string;
            if (groupBy === 'customer') key = order.customer?.name ?? 'Unknown';
            else if (groupBy === 'day') key = order.createdAt.toISOString().split('T')[0];
            else if (groupBy === 'month') key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}`;
            else key = 'All';

            const existing = grouped.get(key) ?? { label: key, revenue: 0, orders: 0 };
            existing.revenue += order.netAmount;
            existing.orders++;
            grouped.set(key, existing);
        }

        return { data: Array.from(grouped.values()), total: orders.reduce((s, o) => s + o.netAmount, 0) };
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
