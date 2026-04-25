import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import * as csv from 'fast-csv';
import { GstUtility } from '../common/utils/gst.util';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(private readonly prisma: PrismaService) { }

    // ─── P&L Report ────────────────────────────────────
    async getProfitAndLoss(orgId: string, startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Revenue: sum of paid/partial invoices
        const invoices = await this.prisma.invoice.findMany({
            where: {
                orgId,
                invoiceDate: { gte: start, lte: end },
                status: { notIn: ['DRAFT', 'CANCELLED'] },
            },
            select: { totalAmount: true },
        });
        const revenue = invoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0);

        // COGS: sum of (quantity * purchasePrice) for delivered orders
        const orderItems = await this.prisma.orderItem.findMany({
            where: {
                order: {
                    orgId,
                    status: { in: ['DELIVERED'] },
                    createdAt: { gte: start, lte: end },
                },
            },
            select: { quantity: true, product: { select: { purchasePrice: true } } },
        });
        const cogs = orderItems.reduce((s, i) => s + (i.quantity * (i.product?.purchasePrice ?? 0)), 0);

        // Expenses grouped by category
        const expenses = await this.prisma.expense.findMany({
            where: {
                orgId,
                date: { gte: start, lte: end },
                status: { not: 'REJECTED' },
            },
            select: { amount: true, taxAmount: true, category: true },
        });

        const byCategory: Record<string, number> = {};
        let totalExpenses = 0;
        for (const exp of expenses) {
            const cat = exp.category || 'OTHER';
            const total = (exp.amount ?? 0) + (exp.taxAmount ?? 0);
            byCategory[cat] = (byCategory[cat] || 0) + total;
            totalExpenses += total;
        }

        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - totalExpenses;

        return {
            period: { startDate, endDate },
            revenue,
            cogs,
            grossProfit,
            grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
            expenses: {
                byCategory,
                total: totalExpenses,
            },
            netProfit,
            netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        };
    }

    // ─── Aging Report ──────────────────────────────────
    async getAgingReport(orgId: string) {
        const now = new Date();

        const invoices = await this.prisma.invoice.findMany({
            where: {
                orgId,
                balanceAmount: { gt: 0 },
                status: { notIn: ['CANCELLED', 'DRAFT'] },
            },
            select: {
                id: true,
                invoiceNumber: true,
                dueDate: true,
                totalAmount: true,
                balanceAmount: true,
                customer: { select: { id: true, name: true } },
            },
            orderBy: { dueDate: 'asc' },
        });

        const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        const customerMap: Record<string, {
            customerId: string;
            customerName: string;
            current: number;
            '1-30': number;
            '31-60': number;
            '61-90': number;
            '90+': number;
            total: number;
            invoices: any[];
        }> = {};

        for (const inv of invoices) {
            const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            let bucket: keyof typeof buckets;

            if (daysOverdue <= 0) bucket = 'current';
            else if (daysOverdue <= 30) bucket = '1-30';
            else if (daysOverdue <= 60) bucket = '31-60';
            else if (daysOverdue <= 90) bucket = '61-90';
            else bucket = '90+';

            buckets[bucket] += inv.balanceAmount;

            const custId = inv.customer.id;
            if (!customerMap[custId]) {
                customerMap[custId] = {
                    customerId: custId,
                    customerName: inv.customer.name,
                    current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0,
                    total: 0,
                    invoices: [],
                };
            }
            customerMap[custId][bucket] += inv.balanceAmount;
            customerMap[custId].total += inv.balanceAmount;
            customerMap[custId].invoices.push({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                totalAmount: inv.totalAmount,
                balanceAmount: inv.balanceAmount,
                dueDate: inv.dueDate,
                daysOverdue: Math.max(0, daysOverdue),
                bucket,
            });
        }

        const customers = Object.values(customerMap).sort((a, b) => b.total - a.total);

        return {
            summary: {
                ...buckets,
                totalOutstanding: Object.values(buckets).reduce((s, v) => s + v, 0),
                invoiceCount: invoices.length,
            },
            customers,
        };
    }

    // ─── Salesman Commission ───────────────────────────
    async getSalesmanCommissions(orgId: string, month: number, year: number) {
        const startIst = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endIst = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);

        // Get all valid orders for the period (including estimated pending/confirmed)
        const orders = await this.prisma.order.findMany({
            where: {
                orgId,
                status: { notIn: ['DRAFT', 'CANCELLED'] },
                OR: [
                    { salesmanId: { not: null } },
                    { commissionTo: { not: null } }
                ],
                createdAt: { gte: startIst, lt: endIst },
            },
            select: {
                salesmanId: true,
                netAmount: true,
                commissionTo: true,
                commissionType: true,
                commissionValue: true,
                items: {
                    select: {
                        quantity: true,
                        totalAmount: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                commissionType: true,
                                commissionValue: true,
                            },
                        },
                    },
                },
            },
        });

        // Get salesmen details
        const salesmen = await this.prisma.salesman.findMany({
            where: { orgId, isActive: true },
            select: { id: true, name: true, territory: true, targetMonthly: true },
        });
        const salesmanMap = new Map(salesmen.map(s => [s.id, s]));

        // Aggregate per salesman/recipient
        const commissionData: Record<string, {
            salesmanId: string;
            name: string;
            territory: string | null;
            targetMonthly: number;
            totalSales: number;
            totalCommission: number;
            orderCount: number;
            productBreakdown: Record<string, { productName: string; quantity: number; lineTotal: number; commission: number }>;
        }> = {};

        for (const order of orders) {
            // Process formal salesmen (product-level commissions)
            if (order.salesmanId) {
                const sid = order.salesmanId;
                const sm = salesmanMap.get(sid);

                if (sm) {
                    if (!commissionData[sid]) {
                        commissionData[sid] = {
                            salesmanId: sid,
                            name: sm.name,
                            territory: sm.territory,
                            targetMonthly: sm.targetMonthly,
                            totalSales: 0,
                            totalCommission: 0,
                            orderCount: 0,
                            productBreakdown: {},
                        };
                    }

                    commissionData[sid].totalSales += order.netAmount;
                    commissionData[sid].orderCount += 1;

                    for (const item of order.items) {
                        const product = item.product;
                        let itemCommission = 0;

                        if (product.commissionType === 'FIXED') {
                            itemCommission = item.quantity * (product.commissionValue ?? 0);
                        } else if (product.commissionType === 'PERCENTAGE') {
                            itemCommission = item.totalAmount * ((product.commissionValue ?? 0) / 100);
                        }

                        commissionData[sid].totalCommission += itemCommission;

                        if (itemCommission > 0) {
                            const pid = product.id;
                            if (!commissionData[sid].productBreakdown[pid]) {
                                commissionData[sid].productBreakdown[pid] = {
                                    productName: product.name,
                                    quantity: 0,
                                    lineTotal: 0,
                                    commission: 0,
                                };
                            }
                            commissionData[sid].productBreakdown[pid].quantity += item.quantity;
                            commissionData[sid].productBreakdown[pid].lineTotal += item.totalAmount;
                            commissionData[sid].productBreakdown[pid].commission += itemCommission;
                        }
                    }
                }
            }

            // Process order-level custom commissions (Mistri, Contractor, etc)
            if (order.commissionTo && order.commissionValue) {
                const customId = `custom_${order.commissionTo}`;

                if (!commissionData[customId]) {
                    commissionData[customId] = {
                        salesmanId: customId,
                        name: order.commissionTo,
                        territory: 'Custom Recipient',
                        targetMonthly: 0,
                        totalSales: 0,
                        totalCommission: 0,
                        orderCount: 0,
                        productBreakdown: {},
                    };
                }

                // If this order isn't already counted by a formal salesman, count its sales
                if (!order.salesmanId) {
                    commissionData[customId].totalSales += order.netAmount;
                    commissionData[customId].orderCount += 1;
                }

                let orderCommission = 0;
                if (order.commissionType === 'FIXED') {
                    orderCommission = order.commissionValue;
                } else if (order.commissionType === 'PERCENTAGE') {
                    orderCommission = order.netAmount * (order.commissionValue / 100);
                }

                commissionData[customId].totalCommission += orderCommission;

                if (orderCommission > 0) {
                    if (!commissionData[customId].productBreakdown['custom_order']) {
                        commissionData[customId].productBreakdown['custom_order'] = {
                            productName: 'Order-Level Custom Commission',
                            quantity: 0,
                            lineTotal: 0,
                            commission: 0,
                        };
                    }
                    commissionData[customId].productBreakdown['custom_order'].quantity += 1;
                    commissionData[customId].productBreakdown['custom_order'].lineTotal += order.netAmount;
                    commissionData[customId].productBreakdown['custom_order'].commission += orderCommission;
                }
            }
        }

        const results = Object.values(commissionData).map(s => ({
            ...s,
            achievement: s.targetMonthly > 0 ? (s.totalSales / s.targetMonthly) * 100 : 0,
            productBreakdown: Object.values(s.productBreakdown).sort((a, b) => b.commission - a.commission),
        })).sort((a, b) => b.totalCommission - a.totalCommission);

        return {
            month,
            year,
            salesmen: results,
            totalCommissions: results.reduce((s, r) => s + r.totalCommission, 0),
            totalSales: results.reduce((s, r) => s + r.totalSales, 0),
        };
    }

    // ─── GST CA Export (existing) ──────────────────────
    async streamCaGstExport(orgId: string, month: number, year: number, res: Response) {
        if (month < 1 || month > 12) {
            throw new BadRequestException('Month must be between 1 and 12');
        }

        const timezone = 'Asia/Kolkata';
        const startIst = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endIst = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);

        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true, gstNumber: true, state: true }
        });

        if (!org) throw new BadRequestException('Organization not found');

        const fileName = `${org.name.replace(/[^a-z0-9]/gi, '_')}_GST_Export_${String(month).padStart(2, '0')}_${year}.csv`;
        res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'text/csv');

        const csvStream = csv.format({ headers: true });
        csvStream.pipe(res);

        let skip = 0;
        const take = 500;
        let hasMore = true;

        try {
            while (hasMore) {
                const orders = await this.prisma.order.findMany({
                    where: {
                        orgId,
                        createdAt: { gte: startIst, lt: endIst },
                        status: { notIn: ['DRAFT', 'CANCELLED'] }
                    },
                    include: {
                        customer: { select: { name: true, gstNumber: true, state: true } },
                        invoice: { select: { invoiceNumber: true } },
                        items: { include: { product: { select: { hsnCode: true, cessRate: true, gstRate: true } } } }
                    },
                    orderBy: { createdAt: 'asc' },
                    skip,
                    take,
                });

                if (orders.length === 0) { hasMore = false; break; }

                for (const order of orders) {
                    const invDate = order.createdAt.toLocaleDateString('en-IN', { timeZone: timezone });
                    const invNo = order.invoice?.invoiceNumber ?? order.orderNumber;
                    const sellerGst = org.gstNumber ?? org.state;
                    const buyerGst = order.customer.gstNumber ?? order.customer.state ?? sellerGst;

                    for (const item of order.items) {
                        const gstRate = item.taxRate ?? item.product?.gstRate ?? 0;
                        const cessRate = item.product?.cessRate ?? 0;
                        const lineTaxable = item.price * item.quantity - (item.discount ?? 0);
                        const taxes = GstUtility.calculateTaxes(sellerGst, buyerGst, lineTaxable, gstRate, cessRate);

                        csvStream.write({
                            'Invoice Date': invDate,
                            'Invoice Number': invNo,
                            'Customer Name': order.customer.name,
                            'Customer GSTIN': order.customer.gstNumber ?? 'Unregistered',
                            'Place of Supply': order.customer.state ?? 'Unknown',
                            'HSN Code': item.product?.hsnCode ?? '',
                            'Quantity': item.quantity,
                            'Taxable Value': taxes.taxableValue.toFixed(2),
                            'CGST Amount': taxes.cgstAmount.toFixed(2),
                            'SGST Amount': taxes.sgstAmount.toFixed(2),
                            'IGST Amount': taxes.igstAmount.toFixed(2),
                            'Cess Amount': taxes.cessAmount.toFixed(2),
                            'Total Invoice Value': (taxes.taxableValue + taxes.totalTaxAmount).toFixed(2),
                        });
                    }
                }
                skip += take;
                if (orders.length < take) hasMore = false;
            }
        } catch (error) {
            this.logger.error('Error generating CA GST Export', error);
        } finally {
            csvStream.end();
        }
    }
}
