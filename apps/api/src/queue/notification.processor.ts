import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PushService } from '../notifications/push.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../notifications/email.service';
import { SMSService } from '../notifications/sms.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor('notification')
export class NotificationProcessor extends WorkerHost {
    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(
        private readonly push: PushService,
        private readonly wa: WhatsAppService,
        private readonly email: EmailService,
        private readonly sms: SMSService,
        private readonly prisma: PrismaService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing notification job: ${job.name} (ID: ${job.id})`);
        const { data } = job;

        try {
            if (job.name === 'send-push') {
                if (data.type === 'new_order' || data.type === 'order_status' || data.type === 'low_stock' || data.type === 'payment_received') {
                    // Send push to owner/admin/manager roles
                    await this.push.sendToOrg(data.orgId, ['OWNER', 'ADMIN', 'MANAGER'], data.title, data.body, {
                        type: data.type,
                        orderId: data.orderId,
                        productId: data.productId,
                        url: data.url || (data.orderId ? `/orders/${data.orderId}` : '/dashboard'),
                    });
                }
            } else if (job.name === 'send-whatsapp') {
                const customer = await this.prisma.customer.findUnique({ where: { id: data.customerId } });
                if (!customer || !customer.phone) return { skipped: true, reason: 'No phone number' };

                if (data.type === 'PAYMENT_RECEIPT') {
                    const payment = await this.prisma.payment.findUnique({ where: { id: data.paymentId }, include: { invoice: true } });
                    if (payment) {
                        const msg = `✅ Received payment of ₹${payment.amount.toLocaleString('en-IN')} for ${payment.invoice ? 'Invoice ' + payment.invoice.invoiceNumber : 'your account'}. Thank you!`;
                        await this.wa.sendText(data.orgId, `91${customer.phone}`, msg);
                    }
                } else if (data.daysOverdue) {
                    const invoice = await this.prisma.invoice.findUnique({ where: { id: data.invoiceId } });
                    if (invoice) {
                        const msg = `⚠️ Payment Reminder: Invoice ${invoice.invoiceNumber} for ₹${invoice.balanceAmount.toLocaleString('en-IN')} is overdue by ${data.daysOverdue} days. Please clear the pending dues.`;
                        await this.wa.sendText(data.orgId, `91${customer.phone}`, msg);
                    }
                } else if (data.type === 'INVOICE_GENERATED') {
                    const invoice = await this.prisma.invoice.findUnique({
                        where: { id: data.invoiceId },
                        include: {
                            organization: { include: { settings: true } },
                            customer: true,
                        },
                    });
                    if (invoice && customer.phone) {
                        const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
                        const to = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                        const orgName = invoice.organization?.name || 'DistroAI';
                        const upiId = invoice.organization?.settings?.upiId;
                        const balance = invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.totalAmount;

                        let upiText = '';
                        if (upiId && balance > 0) {
                            const orgTitle = invoice.organization.name || 'Distributor';
                            const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(orgTitle)}&am=${balance.toFixed(2)}&tr=${encodeURIComponent(invoice.invoiceNumber)}&tn=Invoice+${encodeURIComponent(invoice.invoiceNumber)}&cu=INR`;
                            upiText = `\n💳 *Instant UPI Payment:*\n• Payee UPI: \`${upiId}\`\n• 1-Tap Pay: ${upiUri}\n`;
                        }

                        const viewUrl = invoice.pdfUrl || `${process.env.APP_URL || 'https://distroai.in'}/invoices/${invoice.id}`;
                        const msg =
                            `📄 *Invoice ${invoice.invoiceNumber} Ready — ${orgName}*\n\n` +
                            `Dear *${customer.name}*,\n` +
                            `Your invoice for *₹${invoice.totalAmount.toLocaleString('en-IN')}* has been generated.\n` +
                            (balance < invoice.totalAmount && balance > 0 ? `• Balance Due: *₹${balance.toLocaleString('en-IN')}*\n` : `• Amount Due: *₹${balance.toLocaleString('en-IN')}*\n`) +
                            `• Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n` +
                            `${upiText}\n` +
                            `📄 *View / Download Invoice:*\n${viewUrl}\n\n` +
                            `Thank you for your business!`;

                        await this.wa.sendText(data.orgId, to, msg);

                        if (invoice.pdfUrl) {
                            try {
                                await this.wa.sendDocument(
                                    data.orgId,
                                    to,
                                    invoice.pdfUrl,
                                    `${invoice.invoiceNumber}.pdf`,
                                    `Invoice ${invoice.invoiceNumber}`,
                                );
                            } catch (err) {
                                this.logger.warn(`Failed to attach invoice PDF on WhatsApp: ${(err as Error).message}`);
                            }
                        }
                    }
                }
            } else if (job.name === 'send-whatsapp-briefing') {
                const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
                if (user && user.phone) {
                    await this.wa.sendText(data.orgId, `91${user.phone}`, data.message);
                }
            } else if (job.name === 'send-email') {
                // Generic email send from queue
                await this.email.sendWelcome(data.to, data.firstName, data.orgName, data.tempPassword);
            } else if (job.name === 'send-sms') {
                // Generic SMS send from queue
                await this.sms.sendOTP(data.phone, data.otp);
            }
            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to process job ${job.name}`, (error as Error).stack);
            throw error;
        }
    }
}
