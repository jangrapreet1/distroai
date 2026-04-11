import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsNumber, IsArray, IsDateString, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { QueueService } from '../queue/queue.service';
import { RazorpayService } from '../payments/razorpay.service';
import { EInvoiceService } from './einvoice.service';
import { RedisService } from '../common/services/redis.service';

class InvoiceItemDto {
    @IsString() productId!: string;
    @IsNumber() @Min(1) quantity!: number;
    @IsString() unit!: string;
    @IsNumber() @Min(0) price!: number;
    @IsOptional() @IsNumber() discount?: number;
    @IsOptional() @IsString() hsnCode?: string;
}

export class CreateInvoiceDto {
    @IsString() customerId!: string;
    @IsDateString() invoiceDate!: string;
    @IsOptional() @IsDateString() dueDate?: string;
    @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items!: InvoiceItemDto[];
    @IsOptional() @IsString() notes?: string;
    @IsOptional() @IsString() orderId?: string;
}

export class SendInvoiceDto {
    @IsArray() channels!: string[];
}

export class GstrQueryDto {
    @IsString() from!: string;
    @IsString() to!: string;
}

@Injectable()
export class InvoicesService {
    private readonly logger = new Logger(InvoicesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly queue: QueueService,
        private readonly razorpay: RazorpayService,
        private readonly einvoice: EInvoiceService,
        private readonly redis: RedisService,
    ) { }

    /** Round to 2 decimal places — every INR value must pass through this */
    private r2(n: number) { return Math.round(n * 100) / 100; }

    private calculateGst(amount: number, gstRate: number, sameState: boolean) {
        const gstAmount = this.r2((amount * gstRate) / 100);
        return sameState
            ? { cgstRate: gstRate / 2, sgstRate: gstRate / 2, igstRate: 0, cgstAmount: this.r2(gstAmount / 2), sgstAmount: this.r2(gstAmount / 2), igstAmount: 0 }
            : { cgstRate: 0, sgstRate: 0, igstRate: gstRate, cgstAmount: 0, sgstAmount: 0, igstAmount: this.r2(gstAmount) };
    }

    private async generateInvoiceNumber(orgId: string): Promise<string> {
        const settings = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        const prefix = settings?.invoicePrefix ?? 'INV';
        const year = new Date().getFullYear();
        const count = await this.prisma.invoice.count({ where: { orgId } });
        return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
    }

    async findAll(orgId: string, status?: string, customerId?: string, page = 1, limit = 20) {
        const where = {
            orgId,
            ...(status && { status: status as 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED' }),
            ...(customerId && { customerId }),
        };
        const [data, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where, skip: (page - 1) * limit, take: limit,
                include: { customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.invoice.count({ where }),
        ]);
        return { data, meta: { total, page, limit } };
    }

    async create(orgId: string, dto: CreateInvoiceDto) {
        const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, orgId } });
        if (!customer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Customer not found' });

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        const sameState = (org?.address ?? '') === (customer.state ?? '') || true; // Default same state for now

        let subtotal = 0, discountAmount = 0, taxableAmount = 0;
        let cgstAmount = 0, sgstAmount = 0, igstAmount = 0, cessAmount = 0;

        const itemsData = await Promise.all(dto.items.map(async (item) => {
            const product = await this.prisma.product.findFirst({ where: { id: item.productId, orgId } });
            if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: `Product ${item.productId} not found` });
            const lineTotal = this.r2(item.price * item.quantity);
            const disc = this.r2(item.discount ?? 0);
            const taxable = this.r2(lineTotal - disc);
            const gst = this.calculateGst(taxable, product.gstRate, sameState);
            const cessAmt = this.r2((taxable * (product.cessRate ?? 0)) / 100);
            const total = this.r2(taxable + gst.cgstAmount + gst.sgstAmount + gst.igstAmount + cessAmt);

            subtotal += lineTotal;
            discountAmount += disc;
            taxableAmount += taxable;
            cgstAmount += gst.cgstAmount;
            sgstAmount += gst.sgstAmount;
            igstAmount += gst.igstAmount;
            cessAmount += cessAmt;

            return {
                productId: item.productId, description: product.name,
                hsnCode: item.hsnCode ?? product.hsnCode, quantity: item.quantity,
                unit: item.unit, price: item.price, discount: disc, taxableAmt: taxable,
                gstRate: product.gstRate, ...gst, cessRate: product.cessRate ?? 0, totalAmount: total,
            };
        }));

        const totalAmount = this.r2(taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount);
        const invoiceNumber = await this.generateInvoiceNumber(orgId);
        const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const invoice = await this.prisma.$transaction(async (tx: any) => {
            const inv = await tx.invoice.create({
                data: {
                    orgId, invoiceNumber, customerId: dto.customerId,
                    invoiceDate: new Date(dto.invoiceDate), dueDate, notes: dto.notes,
                    subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, cessAmount,
                    totalAmount, balanceAmount: totalAmount,
                    items: { create: itemsData },
                },
                include: { items: true, customer: { select: { name: true } } },
            });

            // ── Auto-apply unspent customer advances ──
            let invoiceBalance = totalAmount;
            const advancePayments = await tx.payment.findMany({
                where: { orgId, customerId: dto.customerId, advanceAmount: { gt: 0 } },
                orderBy: { paidAt: 'asc' },
            });

            for (const adv of advancePayments) {
                if (invoiceBalance <= 0) break;
                const allocate = this.r2(Math.min(adv.advanceAmount, invoiceBalance));
                if (allocate <= 0) continue;

                // Reduce the advance on the payment
                await tx.payment.update({
                    where: { id: adv.id },
                    data: { advanceAmount: this.r2(adv.advanceAmount - allocate) },
                });

                // Create allocation record
                await tx.paymentAllocation.create({
                    data: { paymentId: adv.id, invoiceId: inv.id, amountAllocated: allocate },
                });

                invoiceBalance = this.r2(invoiceBalance - allocate);
            }

            // Update invoice if advances were applied
            const advanceApplied = this.r2(totalAmount - invoiceBalance);
            if (advanceApplied > 0) {
                await tx.invoice.update({
                    where: { id: inv.id },
                    data: {
                        paidAmount: advanceApplied,
                        balanceAmount: invoiceBalance,
                        status: invoiceBalance <= 0 ? 'PAID' : 'PARTIAL',
                    },
                });
            }

            // ── Update Customer Ledger ──
            // Fetch current customer to get exact balance for ledger
            await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${dto.customerId} FOR UPDATE`;

            const customer = await tx.customer.update({
                where: { id: dto.customerId },
                data: { outstandingAmount: { increment: totalAmount } },
                select: { outstandingAmount: true }
            });

            await tx.ledgerEntry.create({
                data: {
                    orgId,
                    customerId: dto.customerId,
                    type: 'DEBIT',
                    amount: totalAmount,
                    balance: customer.outstandingAmount,
                    referenceId: inv.id,
                    referenceType: 'INVOICE',
                    notes: `Invoice ${invoiceNumber} generated`
                }
            });

            if (dto.orderId) {
                await tx.order.update({
                    where: { id: dto.orderId },
                    data: { invoiceId: inv.id }
                });
            }

            return inv;
        });

        await this.queue.addToQueue('invoice', 'generate-pdf', { invoiceId: invoice.id });
        this.logger.log(`Queued PDF generation for invoice ${invoice.id}`);

        await this.send(orgId, invoice.id, ['whatsapp']);
        this.logger.log(`Queued initial WhatsApp notification for invoice ${invoice.id}`);

        await Promise.all([
            this.redis.del(`analytics:dashboard:${orgId}`),
            this.redis.del(`analytics:sales:${orgId}`)
        ]);

        return invoice;
    }

    async findOne(orgId: string, id: string) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id, orgId },
            include: { items: { include: { product: { select: { name: true, sku: true } } } }, payments: true, customer: true },
        });
        if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });
        return invoice;
    }

    async send(orgId: string, id: string, channels: string[]) {
        const invoice = await this.prisma.invoice.findFirst({ where: { id, orgId } });
        if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });

        for (const channel of channels) {
            if (['whatsapp', 'email', 'sms', 'push'].includes(channel)) {
                await this.queue.addToQueue('notification', `send-${channel}`, {
                    type: 'INVOICE_GENERATED',
                    invoiceId: id,
                    customerId: invoice.customerId,
                    orgId,
                });
            }
        }

        this.logger.log(`Queued invoice ${id} via channels: ${channels.join(', ')}`);
        return { queued: true, channels };
    }

    async generatePdf(orgId: string, id: string) {
        const invoice = await this.prisma.invoice.findFirst({ where: { id, orgId } });
        if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });

        const job = await this.queue.addToQueue('invoice', 'generate-pdf', { invoiceId: id });
        return { jobId: job.id, status: 'queued' };
    }

    async eInvoice(orgId: string, id: string) {
        const invoice = await this.prisma.invoice.findFirst({ where: { id, orgId } });
        if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });

        const result = await this.einvoice.generateIRN(id);
        this.logger.log(`Generated E-Invoice IRN for invoice ${id}: ${result.irn}`);
        return result;
    }

    async eWaybill(_orgId: string, _id: string) {
        return { status: 'not_configured', message: 'E-waybill integration will be set up in Phase 4' };
    }

    async createPaymentLink(orgId: string, id: string) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id, orgId },
            include: { customer: true }
        });
        if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });

        const amountInPaise = Math.round(invoice.balanceAmount * 100);

        const link = await this.razorpay.createPaymentLink({
            amount: amountInPaise,
            currency: 'INR',
            description: `Payment for Invoice ${invoice.invoiceNumber}`,
            customerName: invoice.customer.name,
            customerPhone: invoice.customer.phone || '',
            referenceId: `inv_${invoice.id}_${Date.now()}`,
            notifyWhatsapp: true,
            notifyEmail: true,
        });

        this.logger.log(`Created Razorpay payment link for invoice ${id}: ${link.shortUrl}`);
        return { paymentLinkUrl: link.shortUrl, paymentLinkId: link.id, status: 'created' };
    }

    async getGstr1(orgId: string, from: string, to: string) {
        const invoices = await this.prisma.invoice.findMany({
            where: { orgId, invoiceDate: { gte: new Date(from), lte: new Date(to) }, status: { not: 'CANCELLED' } },
            include: { customer: { select: { name: true, gstNumber: true } }, items: true },
        });

        const b2b: Record<string, unknown[]> = {};
        const b2cTotals = { totalTaxableValue: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0 };
        let totalInvoices = 0, totalTaxableValue = 0, totalTax = 0;

        for (const inv of invoices) {
            totalInvoices++;
            totalTaxableValue += inv.taxableAmount;
            totalTax += inv.cgstAmount + inv.sgstAmount + inv.igstAmount + inv.cessAmount;

            if (inv.customer.gstNumber) {
                const gst = inv.customer.gstNumber;
                if (!b2b[gst]) b2b[gst] = [];
                b2b[gst].push({ invoiceNumber: inv.invoiceNumber, date: inv.invoiceDate, value: inv.totalAmount });
            } else {
                b2cTotals.totalTaxableValue += inv.taxableAmount;
                b2cTotals.totalCgst += inv.cgstAmount;
                b2cTotals.totalSgst += inv.sgstAmount;
                b2cTotals.totalIgst += inv.igstAmount;
            }
        }

        return {
            b2b: Object.entries(b2b).map(([customerGst, invoices]) => ({ customerGst, invoices })),
            b2c: b2cTotals,
            summary: { totalInvoices, totalTaxableValue, totalTax, totalCess: 0 },
        };
    }

    /**
     * Data reconciliation: recalculate customer outstanding from actual invoice balances.
     * Fixes inconsistencies caused by testing or bugs.
     */
    async reconcile(orgId: string) {
        const r2 = (n: number) => Math.round(n * 100) / 100;
        const fixes: { customerId: string; customerName: string; oldOutstanding: number; newOutstanding: number }[] = [];
        const duplicateInvoices: { invoiceId: string; invoiceNumber: string; orderId: string }[] = [];

        // Step 1: Find orders with multiple invoices (duplicates from testing)
        const orders = await this.prisma.order.findMany({
            where: { orgId, invoiceId: { not: null } },
            select: { id: true, invoiceId: true, orderNumber: true },
        });
        const orderInvoiceMap = new Map<string, string>();
        // All invoices that are linked to orders
        const linkedInvoiceIds = new Set(orders.map(o => o.invoiceId).filter(Boolean));

        // Find invoices NOT linked to any order (orphans from duplicate creation)
        const allInvoices = await this.prisma.invoice.findMany({
            where: { orgId },
            select: { id: true, invoiceNumber: true, customerId: true, balanceAmount: true, status: true },
        });

        // Step 2: Recalculate each customer's outstanding from their ACTIVE invoice balances
        const customers = await this.prisma.customer.findMany({
            where: { orgId },
            select: { id: true, name: true, outstandingAmount: true },
        });

        for (const customer of customers) {
            // Sum all unpaid invoice balances for this customer (excluding CANCELLED)
            const invoices = await this.prisma.invoice.findMany({
                where: { orgId, customerId: customer.id, status: { not: 'CANCELLED' } },
                select: { balanceAmount: true },
            });
            const actualOutstanding = r2(invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0));
            const currentOutstanding = r2(customer.outstandingAmount);

            if (actualOutstanding !== currentOutstanding) {
                await this.prisma.customer.update({
                    where: { id: customer.id },
                    data: { outstandingAmount: actualOutstanding },
                });
                fixes.push({
                    customerId: customer.id,
                    customerName: customer.name,
                    oldOutstanding: currentOutstanding,
                    newOutstanding: actualOutstanding,
                });
            }
        }

        // Step 3: Invalidate analytics cache
        await Promise.all([
            this.redis.del(`analytics:dashboard:${orgId}`),
            this.redis.del(`analytics:sales:${orgId}`),
        ]);

        return {
            success: true,
            customersFixed: fixes.length,
            fixes,
            totalInvoices: allInvoices.length,
            message: fixes.length > 0
                ? `Fixed ${fixes.length} customer(s) outstanding amounts`
                : 'All data is consistent — no fixes needed',
        };
    }

    async findCreditNotes(orgId: string, invoiceId?: string) {
        const where: any = { orgId };
        if (invoiceId) where.invoiceId = invoiceId;

        return this.prisma.creditNote.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { name: true, phone: true } },
                returnOrder: { select: { orderNumber: true } },
            },
        });
    }
}
