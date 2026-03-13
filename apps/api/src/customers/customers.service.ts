import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateCustomerDto, UpdateCustomerDto,
    ListCustomersQueryDto, DormantQueryDto,
} from './dto/customers.dto';

@Injectable()
export class CustomersService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(orgId: string, query: ListCustomersQueryDto) {
        const { page = 1, limit = 20, search, type, tier, salesmanId, routeId } = query;
        const where = {
            orgId, isActive: true,
            ...(type && { type: type as 'RETAILER' | 'WHOLESALER' | 'INSTITUTION' }),
            ...(tier && { tier: tier as 'GOLD' | 'SILVER' | 'BRONZE' }),
            ...(salesmanId && { salesmanId }),
            ...(routeId && { routeId }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { phone: { contains: search } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                ],
            }),
        };
        const [data, total] = await Promise.all([
            this.prisma.customer.findMany({
                where, skip: (page - 1) * limit, take: limit,
                select: { id: true, name: true, phone: true, email: true, type: true, tier: true, outstandingAmount: true, paymentScore: true, city: true, salesmanId: true, lastOrderDate: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.customer.count({ where }),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async create(orgId: string, dto: CreateCustomerDto) {
        return this.prisma.customer.create({ data: { orgId, ...dto, type: dto.type as any } });
    }

    async findOne(orgId: string, id: string) {
        const customer = await this.prisma.customer.findFirst({ where: { id, orgId } });
        if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });

        const now = new Date();
        const [orders, payments, stats] = await Promise.all([
            this.prisma.order.findMany({ where: { customerId: id, orgId }, take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, status: true, netAmount: true, createdAt: true } }),
            this.prisma.payment.findMany({ where: { customerId: id, orgId }, take: 10, orderBy: { createdAt: 'desc' } }),
            this.prisma.order.aggregate({ where: { customerId: id, orgId, status: { not: 'CANCELLED' } }, _count: { id: true }, _sum: { netAmount: true, paidAmount: true } }),
        ]);

        // Payment ageing
        const invoices = await this.prisma.invoice.findMany({
            where: { customerId: id, balanceAmount: { gt: 0 } },
            select: { balanceAmount: true, dueDate: true },
        });
        const ageing = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
        for (const inv of invoices) {
            const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (days <= 0) ageing.current += inv.balanceAmount;
            else if (days <= 30) ageing.current += inv.balanceAmount;
            else if (days <= 60) ageing.overdue30 += inv.balanceAmount;
            else if (days <= 90) ageing.overdue60 += inv.balanceAmount;
            else ageing.overdue90 += inv.balanceAmount;
        }

        return {
            customer,
            stats: {
                totalOrders: stats._count.id,
                totalRevenue: stats._sum.netAmount ?? 0,
                totalPaid: stats._sum.paidAmount ?? 0,
                outstanding: customer.outstandingAmount,
                avgOrderValue: stats._count.id > 0 ? (stats._sum.netAmount ?? 0) / stats._count.id : 0,
            },
            recentOrders: orders,
            paymentSummary: ageing,
            recentPayments: payments,
        };
    }

    async update(orgId: string, id: string, dto: UpdateCustomerDto) {
        const customer = await this.prisma.customer.findFirst({ where: { id, orgId } });
        if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });
        return this.prisma.customer.update({ where: { id }, data: { ...dto, tier: dto.tier as any } });
    }

    async getOrders(orgId: string, id: string, page: number, limit: number) {
        const [data, total] = await Promise.all([
            this.prisma.order.findMany({ where: { customerId: id, orgId }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.order.count({ where: { customerId: id, orgId } }),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async getPayments(orgId: string, id: string) {
        const customer = await this.prisma.customer.findFirst({ where: { id, orgId } });
        if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });
        const payments = await this.prisma.payment.findMany({ where: { customerId: id, orgId }, orderBy: { createdAt: 'desc' } });
        return { customer: { id: customer.id, name: customer.name, outstandingAmount: customer.outstandingAmount }, payments };
    }

    async getCreditScore(orgId: string, id: string) {
        const customer = await this.prisma.customer.findFirst({ where: { id, orgId } });
        if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });

        const score = customer.paymentScore;
        const band = score >= 80 ? 'GREEN' : score >= 60 ? 'YELLOW' : score >= 40 ? 'ORANGE' : 'RED';
        const history = await this.prisma.paymentScoreLog.findMany({ where: { customerId: id }, take: 10, orderBy: { createdAt: 'desc' } });

        return {
            score,
            band,
            explanation: `Payment score of ${score} indicates ${band.toLowerCase()} risk. Credit limit: ₹${customer.creditLimit.toLocaleString('en-IN')}`,
            recommendation: score < 60 ? 'Request advance payment. Review credit limit before new orders.' : 'Customer in good standing. Normal credit terms applicable.',
            history,
        };
    }

    async getDormant(orgId: string, query: DormantQueryDto) {
        const days = query.days ?? 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return this.prisma.customer.findMany({
            where: { orgId, isActive: true, OR: [{ lastOrderDate: { lt: cutoff } }, { lastOrderDate: null }] },
            select: { id: true, name: true, phone: true, lastOrderDate: true, outstandingAmount: true, paymentScore: true },
            orderBy: { lastOrderDate: 'asc' },
        });
    }

    async getHighRisk(orgId: string) {
        return this.prisma.customer.findMany({
            where: { orgId, isActive: true, paymentScore: { lt: 60 } },
            select: { id: true, name: true, phone: true, paymentScore: true, outstandingAmount: true, creditLimit: true },
            orderBy: { outstandingAmount: 'desc' },
        });
    }
}
