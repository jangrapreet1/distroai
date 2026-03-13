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
                    // Send push to owner/admin roles
                    await this.push.sendToOrg(data.orgId, ['OWNER', 'ADMIN'], data.title, data.body, {
                        type: data.type,
                        orderId: data.orderId,
                        productId: data.productId,
                    });
                }
            } else if (job.name === 'send-whatsapp') {
                const customer = await this.prisma.customer.findUnique({ where: { id: data.customerId } });
                if (!customer || !customer.phone) return { skipped: true, reason: 'No phone number' };

                if (data.type === 'PAYMENT_RECEIPT') {
                    const payment = await this.prisma.payment.findUnique({ where: { id: data.paymentId }, include: { invoice: true } });
                    if (payment) {
                        const msg = `✅ Received payment of ₹${payment.amount.toLocaleString('en-IN')} for ${payment.invoice ? 'Invoice ' + payment.invoice.invoiceNumber : 'your account'}. Thank you!`;
                        await this.wa.sendText(`91${customer.phone}`, msg);
                    }
                } else if (data.daysOverdue) {
                    const invoice = await this.prisma.invoice.findUnique({ where: { id: data.invoiceId } });
                    if (invoice) {
                        const msg = `⚠️ Payment Reminder: Invoice ${invoice.invoiceNumber} for ₹${invoice.balanceAmount.toLocaleString('en-IN')} is overdue by ${data.daysOverdue} days. Please clear the pending dues.`;
                        await this.wa.sendText(`91${customer.phone}`, msg);
                    }
                }
            } else if (job.name === 'send-whatsapp-briefing') {
                const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
                if (user && user.phone) {
                    await this.wa.sendText(`91${user.phone}`, data.message);
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
