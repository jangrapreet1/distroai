import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Processor('payment-reminder')
export class PaymentProcessor extends WorkerHost {
    private readonly logger = new Logger(PaymentProcessor.name);

    constructor(
        private prisma: PrismaService,
        private whatsappService: WhatsAppService
    ) {
        super();
    }

    async process(job: Job<any>): Promise<any> {
        this.logger.log(`Processing Payment job ${job.name} (ID: ${job.id})`);

        switch (job.name) {
            case 'send-reminder':
                return this.handleSendReminder(job.data);
            default:
                this.logger.warn(`Unknown Payment job name: ${job.name}`);
        }
    }

    private async handleSendReminder(data: { invoiceId: string; orgId: string; customerId: string; daysOverdue: number }) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: data.invoiceId },
            include: { customer: true, organization: { include: { settings: true } } }
        });

        if (!invoice || !invoice.customer.phone || Number(invoice.balanceAmount) <= 0) {
            this.logger.log(`Skipping reminder for invoice ${data.invoiceId} (no phone or fully paid)`);
            return;
        }

        const orgName = invoice.organization.name;
        const upiId = (invoice.organization.settings as any)?.upiId;

        let message = `⚠️ *Payment Reminder*\n\nHi ${invoice.customer.name},\nYour invoice *${invoice.invoiceNumber}* from ${orgName} is *${data.daysOverdue} days overdue*.\n\nPending Amount: *₹${Number(invoice.balanceAmount).toLocaleString('en-IN')}*`;

        if (upiId) {
            const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(orgName)}&am=${Number(invoice.balanceAmount)}&cu=INR`;
            message += `\n\nPay via UPI: ${upiLink}`;
        }

        message += `\n\nPlease clear the dues at the earliest. Reply 'balance' to this chat to check your total outstanding.`;

        await this.whatsappService.sendText(invoice.customer.phone, message);
        this.logger.log(`Sent payment reminder for invoice ${invoice.invoiceNumber} to ${invoice.customer.phone}`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`Payment Job ${job.id} failed: ${error.message}`, error.stack);
    }
}
