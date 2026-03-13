import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';

interface PaymentLinkParams {
    amount: number;          // in paise
    currency: string;
    description: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    referenceId: string;
    expiryDate?: Date;
    notifyWhatsapp?: boolean;
    notifySms?: boolean;
    notifyEmail?: boolean;
}

@Injectable()
export class RazorpayService {
    private readonly logger = new Logger(RazorpayService.name);
    private client: Razorpay | null = null;
    private readonly webhookSecret: string;
    private readonly isConfigured: boolean;

    constructor(private config: ConfigService) {
        const keyId = config.get<string>('RAZORPAY_KEY_ID');
        const keySecret = config.get<string>('RAZORPAY_KEY_SECRET');
        this.webhookSecret = config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
        this.isConfigured = !!(keyId && keySecret);

        if (this.isConfigured) {
            this.client = new Razorpay({ key_id: keyId!, key_secret: keySecret! });
            this.logger.log('Razorpay client configured');
        } else {
            this.logger.warn('Razorpay not configured — payment features will be stubbed');
        }
    }

    async createPaymentLink(params: PaymentLinkParams): Promise<{ id: string; shortUrl: string }> {
        if (!this.client) {
            const stubId = `stub_pl_${Date.now()}`;
            this.logger.log(`[RAZORPAY STUB] createPaymentLink: ${JSON.stringify(params)}`);
            return { id: stubId, shortUrl: `https://rzp.io/i/${stubId}` };
        }

        const link = await (this.client as any).paymentLink.create({
            amount: params.amount,
            currency: params.currency || 'INR',
            description: params.description,
            customer: {
                name: params.customerName,
                contact: params.customerPhone,
                ...(params.customerEmail && { email: params.customerEmail }),
            },
            reference_id: params.referenceId,
            ...(params.expiryDate && { expire_by: Math.floor(params.expiryDate.getTime() / 1000) }),
            notify: {
                sms: params.notifySms ?? false,
                email: params.notifyEmail ?? false,
                whatsapp: params.notifyWhatsapp ?? false,
            },
            callback_url: '',
            callback_method: 'get',
        });

        return { id: link.id, shortUrl: link.short_url };
    }

    async createOrder(amount: number, currency: string, receipt: string): Promise<{ id: string }> {
        if (!this.client) {
            const stubId = `stub_order_${Date.now()}`;
            this.logger.log(`[RAZORPAY STUB] createOrder: amount=${amount}`);
            return { id: stubId };
        }
        return this.client.orders.create({ amount, currency, receipt });
    }

    verifyWebhookSignature(payload: string, signature: string): boolean {
        if (!this.webhookSecret) return true; // skip verification if not configured
        const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
        return expected === signature;
    }

    async fetchPayment(paymentId: string): Promise<Record<string, unknown>> {
        if (!this.client) {
            return { id: paymentId, status: 'captured', amount: 0 };
        }
        return this.client.payments.fetch(paymentId) as any;
    }
}
