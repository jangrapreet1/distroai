import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../common/services/redis.service';

export class CreatePaymentDto {
    @IsOptional() @IsString() invoiceId?: string;
    @IsString() customerId!: string;
    @IsNumber() @Min(0.01) amount!: number;
    @IsEnum(['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT']) method!: 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT';
    @IsOptional() @IsString() referenceNumber?: string;
    @IsOptional() @IsString() notes?: string;
    @IsOptional() @IsDateString() paidAt?: string;
}

// Payment risk score calculation — exported for unit tests
export function calculatePaymentScore(params: {
    avgPaymentDelay: number;
    partialPaymentRatio: number;
    delayTrend: number;
    outstandingRatio: number;
}): number {
    let score = 100;
    score -= Math.min(params.avgPaymentDelay * 2, 40);
    score -= params.partialPaymentRatio * 20;
    score -= Math.min(params.delayTrend * 10, 20);
    score -= Math.min(Math.max(0, (params.outstandingRatio - 0.7) * 40), 20);
    return Math.max(0, Math.round(score));
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly queue: QueueService,
        private readonly redis: RedisService,
    ) { }

    async findAll(orgId: string, params: { customerId?: string; method?: string; status?: string; page?: number; limit?: number }) {
        const { page = 1, limit = 20, customerId, method, status } = params;
        const where = { orgId, ...(customerId && { customerId }), ...(method && { method: method as 'CASH' }), ...(status && { status: status as 'COMPLETED' }) };
        const [data, total] = await Promise.all([
            this.prisma.payment.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } } } }),
            this.prisma.payment.count({ where }),
        ]);
        return { data, meta: { total, page, limit } };
    }

    async create(orgId: string, dto: CreatePaymentDto) {
        const payment = await this.prisma.$transaction(async (tx: any) => {
            await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${dto.customerId} FOR UPDATE`;

            // Guard: reject payment if the target invoice is already fully paid
            if (dto.invoiceId) {
                const targetInv = await tx.invoice.findFirst({ where: { id: dto.invoiceId, orgId } });
                if (targetInv && targetInv.balanceAmount <= 0) {
                    throw new BadRequestException({ code: 'ALREADY_PAID', message: 'This invoice is already fully paid' });
                }
            }

            const payment = await tx.payment.create({
                data: { orgId, customerId: dto.customerId, invoiceId: dto.invoiceId, amount: dto.amount, method: dto.method, referenceNumber: dto.referenceNumber, notes: dto.notes, paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(), status: 'COMPLETED' },
            });

            let remainingAmount = dto.amount;

            if (dto.invoiceId) {
                // Apply to the specific invoice first
                const invoice = await tx.invoice.findFirst({ where: { id: dto.invoiceId, orgId } });
                if (invoice && invoice.balanceAmount > 0) {
                    const allocate = Math.min(remainingAmount, invoice.balanceAmount);
                    const newPaid = invoice.paidAmount + allocate;
                    const newBalance = invoice.balanceAmount - allocate;
                    await tx.invoice.update({
                        where: { id: invoice.id },
                        data: { paidAmount: newPaid, balanceAmount: newBalance, status: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
                    });
                    await tx.paymentAllocation.create({
                        data: { paymentId: payment.id, invoiceId: invoice.id, amountAllocated: allocate }
                    });

                    // Sync payment to the linked Order (Order.invoiceId → Invoice.id)
                    const linkedOrder = await tx.order.findFirst({ where: { invoiceId: invoice.id } });
                    if (linkedOrder) {
                        await tx.order.update({
                            where: { id: linkedOrder.id },
                            data: {
                                paidAmount: newPaid,
                                balanceAmount: newBalance,
                            }
                        });
                    }

                    remainingAmount -= allocate;
                }
            }

            if (remainingAmount > 0) {
                // Auto-allocate remaining amount to oldest unpaid invoices (FIFO)
                const unpaidInvoices = await tx.invoice.findMany({
                    where: { orgId, customerId: dto.customerId, balanceAmount: { gt: 0 } },
                    orderBy: { dueDate: 'asc' },
                });

                for (const inv of unpaidInvoices) {
                    if (remainingAmount <= 0) break;
                    const allocate = Math.min(remainingAmount, inv.balanceAmount);
                    const newPaid = inv.paidAmount + allocate;
                    const newBalance = inv.balanceAmount - allocate;
                    await tx.invoice.update({
                        where: { id: inv.id },
                        data: { paidAmount: newPaid, balanceAmount: newBalance, status: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
                    });
                    await tx.paymentAllocation.create({
                        data: { paymentId: payment.id, invoiceId: inv.id, amountAllocated: allocate }
                    });

                    // Sync payment to the linked Order (Order.invoiceId → Invoice.id)
                    const linkedOrder = await tx.order.findFirst({ where: { invoiceId: inv.id } });
                    if (linkedOrder) {
                        await tx.order.update({
                            where: { id: linkedOrder.id },
                            data: {
                                paidAmount: newPaid,
                                balanceAmount: newBalance,
                            }
                        });
                    }

                    remainingAmount -= allocate;
                }
            }

            if (remainingAmount > 0) {
                // If there's still money left, log it as an advance attached to the payment
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { advanceAmount: remainingAmount }
                });
            }

            // Decrement outstanding mathematically by the FULL payment amount
            // Advance portion is just money we owe them (negative outstanding)
            const customer = await tx.customer.update({
                where: { id: dto.customerId },
                data: { outstandingAmount: { decrement: dto.amount } },
                select: { outstandingAmount: true }
            });

            await tx.ledgerEntry.create({
                data: {
                    orgId,
                    customerId: dto.customerId,
                    type: 'CREDIT',
                    amount: dto.amount,
                    balance: customer.outstandingAmount,
                    referenceId: payment.id,
                    referenceType: 'PAYMENT',
                    notes: `Payment received: ${dto.method}`
                }
            });

            // Async: trigger payment score recalculation (log for now)
            this.logger.log(`[TODO] Recalculate payment score for customer ${dto.customerId}`);

            return payment;
        });

        // Invalidate analytics cache AFTER transaction commits (#9)
        await Promise.all([
            this.redis.del(`analytics:dashboard:${orgId}`),
            this.redis.del(`analytics:sales:${orgId}`)
        ]);

        return payment;
    }


    async handleRazorpayWebhook(rawBody: Buffer, signature: string) {
        const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');

        // In production, webhook secret MUST be configured
        if (!secret && this.config.get('NODE_ENV') === 'production') {
            throw new BadRequestException({ code: 'FORBIDDEN', message: 'Webhook secret not configured' });
        }

        if (secret) {
            const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
            if (computed !== signature) {
                throw new BadRequestException({ code: 'FORBIDDEN', message: 'Invalid webhook signature' });
            }
        }

        const payload = JSON.parse(rawBody.toString()) as {
            event: string;
            payload: {
                payment?: {
                    entity?: {
                        id: string;
                        amount: number;
                        notes?: { orgId?: string, invoiceId?: string, customerId?: string }
                    }
                }
            }
        };
        this.logger.log(`[Razorpay Webhook] Event: ${payload.event}`);

        if (payload.event === 'payment.captured' || payload.event === 'payment_link.paid') {
            const entity = payload.payload.payment?.entity;
            if (entity && entity.notes?.orgId && entity.notes?.customerId) {
                const orgId = entity.notes.orgId;
                const customerId = entity.notes.customerId;
                const invoiceId = entity.notes.invoiceId;
                // amount is in paise, convert to actual
                const amount = entity.amount / 100;
                const referenceNumber = entity.id;

                // Idempotency check: skip if this Razorpay payment was already processed (#2)
                const existing = await this.prisma.payment.findFirst({
                    where: { referenceNumber, orgId },
                });
                if (existing) {
                    this.logger.warn(`[Razorpay Webhook] Duplicate payment skipped: ${referenceNumber}`);
                    return { received: true, duplicate: true };
                }

                // Create payment
                const payment = await this.create(orgId, {
                    customerId,
                    invoiceId,
                    amount,
                    method: 'UPI', // Defaulting Razorpay to UPI for now
                    referenceNumber,
                    notes: 'Paid via Razorpay',
                });

                // Queue WhatsApp receipt
                await this.queue.addToQueue('notification', 'send-whatsapp', {
                    type: 'PAYMENT_RECEIPT',
                    orgId,
                    customerId,
                    paymentId: payment.id,
                });
            } else {
                this.logger.warn(`Webhook missing notes metadata: ${JSON.stringify(entity?.notes)}`);
            }
        }

        return { received: true };
    }

    async getOutstanding(orgId: string) {
        // Read pre-computed aging buckets from Customer (populated by nightly cron)
        const customers = await this.prisma.customer.findMany({
            where: { orgId, outstandingAmount: { gt: 0 } },
            select: {
                id: true, name: true, phone: true, paymentScore: true,
                outstandingAmount: true,
                currentBilled: true, overdue30: true, overdue60: true, overdue90: true,
                avgDaysOverdue: true, oldestDueDate: true, lastAgingCalculatedAt: true,
            },
        });

        return customers.map((c) => ({
            customer: { id: c.id, name: c.name, phone: c.phone, paymentScore: c.paymentScore },
            total: c.outstandingAmount,
            avgDaysOverdue: c.avgDaysOverdue,
            buckets: {
                current: c.currentBilled,
                overdue30: c.overdue30,
                overdue60: c.overdue60,
                overdue90: c.overdue90,
            },
            oldestDueDate: c.oldestDueDate,
            lastAgingCalculatedAt: c.lastAgingCalculatedAt,
            paymentLinkUrl: null,
        })).sort((a, b) => b.total - a.total);
    }

    async getCollectionPlan(orgId: string) {
        // Read pre-computed aging data from Customer (populated by nightly cron)
        const customers = await this.prisma.customer.findMany({
            where: { orgId, outstandingAmount: { gt: 0 } },
            select: {
                id: true, name: true, phone: true, whatsappNumber: true,
                outstandingAmount: true, paymentScore: true, avgDaysOverdue: true,
                lastAgingCalculatedAt: true,
            },
        });

        const scored = customers.map((c) => {
            const priorityScore = c.avgDaysOverdue * 0.4 + (c.outstandingAmount / 1000) * 0.3 + ((100 - c.paymentScore) * 0.3);
            return {
                customer: { id: c.id, name: c.name, phone: c.phone, whatsappNumber: c.whatsappNumber },
                outstandingAmount: c.outstandingAmount,
                paymentScore: c.paymentScore,
                priorityScore: Math.round(priorityScore * 100) / 100,
                suggestedCollectionAmount: c.outstandingAmount,
                lastAgingCalculatedAt: c.lastAgingCalculatedAt,
            };
        });

        return scored.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 20);
    }
}
