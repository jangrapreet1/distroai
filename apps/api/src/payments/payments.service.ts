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
        return this.prisma.$transaction(async (tx: any) => {
            const payment = await tx.payment.create({
                data: { orgId, customerId: dto.customerId, invoiceId: dto.invoiceId, amount: dto.amount, method: dto.method, referenceNumber: dto.referenceNumber, notes: dto.notes, paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(), status: 'COMPLETED' },
            });

            if (dto.invoiceId) {
                // Explicit invoice — update just that one
                const invoice = await tx.invoice.findFirst({ where: { id: dto.invoiceId, orgId } });
                if (invoice) {
                    const newPaid = invoice.paidAmount + dto.amount;
                    const newBalance = invoice.totalAmount - newPaid;
                    await tx.invoice.update({
                        where: { id: dto.invoiceId },
                        data: { paidAmount: newPaid, balanceAmount: Math.max(0, newBalance), status: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
                    });
                }
            } else {
                // No specific invoice — auto-allocate to oldest unpaid invoices (FIFO)
                const unpaidInvoices = await tx.invoice.findMany({
                    where: { orgId, customerId: dto.customerId, balanceAmount: { gt: 0 } },
                    orderBy: { dueDate: 'asc' },
                });

                let remaining = dto.amount;
                for (const inv of unpaidInvoices) {
                    if (remaining <= 0) break;
                    const allocate = Math.min(remaining, inv.balanceAmount);
                    const newPaid = inv.paidAmount + allocate;
                    const newBalance = inv.totalAmount - newPaid;
                    await tx.invoice.update({
                        where: { id: inv.id },
                        data: { paidAmount: newPaid, balanceAmount: Math.max(0, newBalance), status: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
                    });
                    remaining -= allocate;
                }
            }

            await tx.customer.update({ where: { id: dto.customerId }, data: { outstandingAmount: { decrement: dto.amount } } });

            // Async: trigger payment score recalculation (log for now)
            this.logger.log(`[TODO] Recalculate payment score for customer ${dto.customerId}`);

            await Promise.all([
                this.redis.del(`analytics:dashboard:${orgId}`),
                this.redis.del(`analytics:sales:${orgId}`)
            ]);

            return payment;
        });
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
        const now = new Date();
        const customers = await this.prisma.customer.findMany({
            where: { orgId, outstandingAmount: { gt: 0 } },
            include: { invoices: { where: { balanceAmount: { gt: 0 } }, orderBy: { dueDate: 'asc' }, take: 1 } },
        });

        return customers.map((c) => {
            const oldestInvoice = c.invoices[0];
            const buckets = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
            buckets.current = c.outstandingAmount;

            // Calculate pseudo avgDaysOverdue from the oldest invoice or default
            let avgDaysOverdue = 0;
            if (oldestInvoice && oldestInvoice.dueDate) {
                const diffTime = Math.abs(now.getTime() - oldestInvoice.dueDate.getTime());
                avgDaysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            return {
                customer: { id: c.id, name: c.name, phone: c.phone, paymentScore: c.paymentScore },
                total: c.outstandingAmount,
                avgDaysOverdue,
                buckets,
                oldestInvoice: oldestInvoice ? { invoiceNumber: oldestInvoice.invoiceNumber, dueDate: oldestInvoice.dueDate, amount: oldestInvoice.balanceAmount } : null,
                paymentLinkUrl: null,
            };
        }).sort((a, b) => b.total - a.total);
    }

    async getCollectionPlan(orgId: string) {
        const now = new Date();
        const customers = await this.prisma.customer.findMany({
            where: { orgId, outstandingAmount: { gt: 0 } },
            include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });

        const scored = customers.map((c) => {
            const oldestInvoice = null as null;
            const daysOverdue = 30; // simplified
            const priorityScore = daysOverdue * 0.4 + (c.outstandingAmount / 1000) * 0.3 + ((100 - c.paymentScore) * 0.3);
            return {
                customer: { id: c.id, name: c.name, phone: c.phone, whatsappNumber: c.whatsappNumber },
                outstandingAmount: c.outstandingAmount,
                paymentScore: c.paymentScore,
                priorityScore: Math.round(priorityScore * 100) / 100,
                lastPaymentDate: c.payments[0]?.createdAt ?? null,
                suggestedCollectionAmount: c.outstandingAmount,
            };
        });

        return scored.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 20);
    }
}
