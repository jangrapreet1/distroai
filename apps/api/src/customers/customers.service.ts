import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateCustomerDto, UpdateCustomerDto,
    ListCustomersQueryDto, DormantQueryDto,
} from './dto/customers.dto';
import { PLAN_LIMITS } from '../common/config/plan-limits.config';

@Injectable()
export class CustomersService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

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
        const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
        if (!org) throw new NotFoundException('Organization not found');
        const planKey = org.plan as keyof typeof PLAN_LIMITS;
        const currentCount = await this.prisma.customer.count({ where: { orgId } });
        const limit = PLAN_LIMITS[planKey]?.maxCustomers || 100;

        if (currentCount >= limit) {
            throw new BadRequestException({ code: 'PLAN_LIMIT_REACHED', message: `Your plan allows a maximum of ${limit} customers.` });
        }

        // Prevent duplicate customers with the same phone in the same org
        if (dto.phone) {
            const existing = await this.prisma.customer.findFirst({
                where: { orgId, phone: dto.phone, isActive: true },
            });
            if (existing) {
                throw new ConflictException({
                    code: 'CONFLICT',
                    message: `A customer with phone ${dto.phone} already exists: "${existing.name}"`,
                    existingCustomerId: existing.id,
                });
            }
        }
        const customer = await this.prisma.customer.create({ data: { orgId, ...dto, type: dto.type as any } });
        return customer;
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

    async getActivity(orgId: string, id: string, page = 1, limit = 20) {
        const customer = await this.prisma.customer.findFirst({ where: { id, orgId } });
        if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });

        const skip = (page - 1) * limit;
        const fetchLimit = skip + limit;

        const [orders, payments, locationRequests] = await Promise.all([
            this.prisma.order.findMany({ where: { customerId: id, orgId }, orderBy: { createdAt: 'desc' }, take: fetchLimit }),
            this.prisma.payment.findMany({ where: { customerId: id, orgId }, orderBy: { createdAt: 'desc' }, take: fetchLimit }),
            this.prisma.locationRequest.findMany({ where: { customerId: id, orgId, status: 'COMPLETED' }, orderBy: { updatedAt: 'desc' }, take: fetchLimit })
        ]);

        const activities: any[] = [
            ...orders.map(o => ({
                id: o.id,
                type: o.status === 'RETURNED' ? 'ORDER_RETURNED' : o.status === 'DELIVERED' ? 'ORDER_DELIVERED' : 'ORDER_PLACED',
                title: o.status === 'RETURNED' ? `Order Returned` : o.status === 'DELIVERED' ? `Order Delivered` : `Order Placed`,
                description: `Order ${o.orderNumber}`,
                amount: o.netAmount,
                status: o.status,
                createdAt: o.createdAt
            })),
            ...payments.map(p => ({
                id: p.id,
                type: 'PAYMENT_RECEIVED',
                title: 'Payment Received',
                description: `Received via ${p.method}`,
                amount: p.amount,
                status: p.status,
                createdAt: p.createdAt
            })),
            ...locationRequests.map(lr => ({
                id: lr.id,
                type: 'LOCATION_SHARED',
                title: 'Location Shared',
                description: 'Customer shared their GPS coordinates',
                amount: null,
                status: lr.status,
                createdAt: lr.updatedAt
            }))
        ];

        activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const paginated = activities.slice(skip, skip + limit);

        return {
            data: paginated,
            meta: { page, limit, hasMore: activities.length > skip + limit }
        };
    }

    async createLocationRequest(orgId: string, customerId: string) {
        const customer = await this.prisma.customer.findFirst({ where: { id: customerId, orgId } });
        if (!customer) throw new NotFoundException('Customer not found');

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

        const request = await this.prisma.locationRequest.create({
            data: {
                orgId,
                customerId,
                token,
                expiresAt,
            }
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return {
            url: `${baseUrl}/locate/${token}`,
            expiresAt,
        };
    }

    async publicGetLocationRequest(token: string) {
        const request = await this.prisma.locationRequest.findUnique({
            where: { token },
            include: { customer: { select: { name: true, organization: { select: { name: true } } } } }
        });

        if (!request) return { valid: false, reason: 'Invalid link' };
        if (request.status === 'COMPLETED') return { valid: false, reason: 'Location already shared' };
        if (new Date() > request.expiresAt || request.status === 'EXPIRED') return { valid: false, reason: 'Link expired' };

        return {
            valid: true,
            orgName: request.customer.organization.name,
            customerName: request.customer.name,
        };
    }

    async publicSubmitLocation(token: string, lat: number, lng: number) {
        const request = await this.prisma.locationRequest.findUnique({ where: { token } });
        if (!request || request.status !== 'PENDING' || new Date() > request.expiresAt) {
            throw new Error('Invalid or expired request');
        }

        await this.prisma.$transaction([
            this.prisma.customer.update({
                where: { id: request.customerId },
                data: { latitude: lat, longitude: lng }
            }),
            this.prisma.locationRequest.update({
                where: { id: request.id },
                data: { status: 'COMPLETED' }
            })
        ]);

        return { success: true };
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
