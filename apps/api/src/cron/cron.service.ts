import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(
        private prisma: PrismaService,
        private queueService: QueueService,
    ) { }

    // Daily briefing — 7:45 AM IST
    @Cron('45 2 * * *') // 2:15 UTC = 7:45 IST
    async generateDailyBriefings() {
        this.logger.log('Running daily briefing cron...');
        const orgs = await this.prisma.organization.findMany({
            where: {
                users: {
                    some: {
                        role: { in: ['OWNER', 'ADMIN'] },
                        phone: { not: null },
                    },
                },
            },
            select: { id: true },
        });

        for (const org of orgs) {
            await this.queueService.addToQueue('ai', 'generate-briefing', { orgId: org.id });
        }
        this.logger.log(`Queued briefings for ${orgs.length} orgs`);
    }

    // Payment reminders — 10:00 AM IST
    @Cron('30 4 * * *') // 4:30 UTC = 10:00 IST
    async sendPaymentReminders() {
        this.logger.log('Running payment reminder cron...');
        const today = new Date();

        for (const days of [-3, 0, 3, 7]) {
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() - days);
            const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
            const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

            const overdueInvoices = await this.prisma.invoice.findMany({
                where: {
                    status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
                    dueDate: { gte: dayStart, lte: dayEnd },
                    balanceAmount: { gt: 0 },
                },
                select: { id: true, orgId: true, customerId: true },
            });

            for (const inv of overdueInvoices) {
                await this.queueService.addToQueue('payment-reminder', 'send-reminder', {
                    invoiceId: inv.id, orgId: inv.orgId, customerId: inv.customerId, daysOverdue: days,
                });
            }
            this.logger.log(`Queued ${overdueInvoices.length} reminders for offset ${days} (days past due)`);
        }

        // Auto-mark invoices as OVERDUE if they passed due date without being fully PAID
        const yesterdayEnd = new Date(today);
        yesterdayEnd.setHours(0, 0, 0, 0); // Effectively midnight earlier today
        const marked = await this.prisma.invoice.updateMany({
            where: {
                status: { in: ['DRAFT', 'SENT', 'PARTIAL'] },
                dueDate: { lt: yesterdayEnd },
                balanceAmount: { gt: 0 }
            },
            data: { status: 'OVERDUE' }
        });
        this.logger.log(`Auto-marked ${marked.count} invoices as OVERDUE`);
    }

    // Demand forecast — 2:00 AM IST
    @Cron('30 20 * * *') // 20:30 UTC = 2:00 IST
    async runDemandForecasts() {
        this.logger.log('Running demand forecast cron...');
        const orgs = await this.prisma.organization.findMany({ select: { id: true } });

        for (const org of orgs) {
            const products = await this.prisma.product.findMany({
                where: { orgId: org.id, isActive: true },
                select: { id: true },
            });

            for (const product of products) {
                await this.queueService.addToQueue('ai', 'run-forecast', {
                    orgId: org.id, productId: product.id,
                });
            }
        }
    }

    // Payment score recalculation — 6:00 AM IST
    @Cron('30 0 * * *') // 0:30 UTC = 6:00 IST
    async recalculatePaymentScores() {
        this.logger.log('Running payment score recalc cron...');
        const orgs = await this.prisma.organization.findMany({ select: { id: true } });

        for (const org of orgs) {
            await this.queueService.addToQueue('ai', 'compute-payment-scores', { orgId: org.id });
        }
        this.logger.log(`Queued score recalc for ${orgs.length} orgs`);
    }

    // Weekly digest — Monday 9:00 AM IST
    @Cron('30 3 * * 1') // 3:30 UTC Monday = 9:00 IST
    async sendWeeklyDigests() {
        this.logger.log('Running weekly digest cron...');
        const orgs = await this.prisma.organization.findMany({
            where: { users: { some: { role: 'OWNER' } } },
            select: { id: true },
        });

        for (const org of orgs) {
            await this.queueService.addToQueue('ai', 'generate-weekly-digest', { orgId: org.id });
        }
    }

    // AR Aging bucket recalculation — Midnight IST
    @Cron('30 18 * * *') // 18:30 UTC = 00:00 IST
    async recalculateAgingBuckets() {
        this.logger.log('Running AR aging bucket recalculation...');
        const now = new Date();
        const nowTime = now.getTime();
        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        // DRIFT-SAFE: Query unpaid invoices directly, never trust outstandingAmount
        const unpaidInvoices = await this.prisma.invoice.findMany({
            where: {
                balanceAmount: { gt: 0 },
                status: { notIn: ['CANCELLED', 'PAID'] },
            },
            select: {
                customerId: true,
                balanceAmount: true,
                dueDate: true,
            },
        });

        // Group by customerId
        const customerBuckets = new Map<string, {
            current: number; overdue30: number; overdue60: number; overdue90: number;
            oldestDueDate: Date | null; totalDaysOverdue: number; overdueCount: number;
        }>();

        for (const inv of unpaidInvoices) {
            if (!customerBuckets.has(inv.customerId)) {
                customerBuckets.set(inv.customerId, {
                    current: 0, overdue30: 0, overdue60: 0, overdue90: 0,
                    oldestDueDate: null, totalDaysOverdue: 0, overdueCount: 0,
                });
            }
            const b = customerBuckets.get(inv.customerId)!;
            const daysOverdue = Math.floor((nowTime - inv.dueDate.getTime()) / MS_PER_DAY);

            if (daysOverdue <= 0) {
                b.current += inv.balanceAmount;
            } else if (daysOverdue <= 30) {
                b.overdue30 += inv.balanceAmount;
            } else if (daysOverdue <= 60) {
                b.overdue60 += inv.balanceAmount;
            } else {
                b.overdue90 += inv.balanceAmount;
            }

            if (daysOverdue > 0) {
                b.totalDaysOverdue += daysOverdue;
                b.overdueCount++;
            }

            if (!b.oldestDueDate || inv.dueDate < b.oldestDueDate) {
                b.oldestDueDate = inv.dueDate;
            }
        }

        // Batch update each customer
        let updated = 0;
        for (const [customerId, b] of customerBuckets) {
            const r2 = (n: number) => Math.round(n * 100) / 100;
            await this.prisma.customer.update({
                where: { id: customerId },
                data: {
                    currentBilled: r2(b.current),
                    overdue30: r2(b.overdue30),
                    overdue60: r2(b.overdue60),
                    overdue90: r2(b.overdue90),
                    avgDaysOverdue: b.overdueCount > 0 ? Math.round(b.totalDaysOverdue / b.overdueCount) : 0,
                    oldestDueDate: b.oldestDueDate,
                    lastAgingCalculatedAt: now,
                },
            });
            updated++;
        }

        this.logger.log(`AR aging recalculated for ${updated} customers from ${unpaidInvoices.length} unpaid invoices`);
    }
}
