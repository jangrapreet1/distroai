import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Processor('payment-reminder')
export class PaymentReminderProcessor extends WorkerHost {
    private readonly logger = new Logger(PaymentReminderProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wa: WhatsAppService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing job ${job.name} - ${job.id}`);

        if (job.name === 'send-reminder') {
            await this.handleSendReminder(job.data);
        }
    }

    private async handleSendReminder(data: { invoiceId: string; orgId: string; customerId: string; daysOverdue: number }) {
        const { invoiceId, orgId, customerId, daysOverdue } = data;

        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { customer: true, organization: { include: { settings: true } } },
        });

        if (!invoice || !invoice.customer || invoice.balanceAmount <= 0) {
            this.logger.log(`Skipping reminder for invoice ${invoiceId} — not found or already paid`);
            return;
        }

        const phone = invoice.customer.phone;
        if (!phone) {
            this.logger.warn(`Cannot send reminder to customer ${customerId} — no phone number`);
            return;
        }

        // Prepare message
        const amount = Number(invoice.balanceAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        const isOverdue = daysOverdue > 0;
        
        let msg = `Hello ${invoice.customer.name},\n\n`;
        msg += `This is a friendly reminder that your invoice *${invoice.invoiceNumber}* for ${amount} is `;
        if (isOverdue) {
            msg += `*overdue by ${daysOverdue} days*.`;
        } else if (daysOverdue === 0) {
            msg += `*due today*.`;
        } else {
            msg += `due in ${Math.abs(daysOverdue)} days.`;
        }

        // Add payment link if Razorpay is configured
        if ((invoice as any).paymentLinkId) {
            msg += `\n\nYou can easily pay online via this secure link:\n${(invoice as any).paymentLinkId}`;
        } else {
            // Check for UPI
            const upiId = (invoice.organization?.settings as any)?.upiId;
            if (upiId) {
                const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(invoice.organization.name)}&am=${invoice.balanceAmount}&cu=INR`;
                msg += `\n\nYou can pay via UPI:\n${upiLink}`;
            }
        }

        msg += `\n\nThank you for your business!`;

        // Send via WA
        try {
            await this.wa.sendText(orgId, phone, msg);
            this.logger.log(`Sent reminder for invoice ${invoiceId} to ${phone}`);
        } catch (error) {
            this.logger.error(`Failed to send WhatsApp reminder to ${phone}: ${(error as Error).message}`);
            throw error; // Let BullMQ retry
        }
    }
}
