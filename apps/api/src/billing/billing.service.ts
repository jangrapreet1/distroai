import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// Plan pricing in paise (Razorpay uses smallest currency unit)
const PLAN_PRICES: Record<string, { amount: number; label: string }> = {
    STARTER: { amount: 49900, label: 'Starter — ₹499/mo' },
    GROWTH: { amount: 89900, label: 'Growth — ₹899/mo' },
    ENTERPRISE: { amount: 0, label: 'Enterprise — Custom' },
};

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);
    private razorpay: any;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
        const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
        if (keyId && keySecret) {
            // Dynamic import to avoid hard crash if razorpay isn't configured
            const Razorpay = require('razorpay');
            this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
            this.logger.log('Razorpay initialized');
        } else {
            this.logger.warn('Razorpay keys not configured — billing disabled');
        }
    }

    /**
     * Create a Razorpay Order for the selected plan upgrade.
     */
    async createCheckoutOrder(orgId: string, planName: string) {
        if (!this.razorpay) {
            throw new BadRequestException({ code: 'BILLING_DISABLED', message: 'Payment gateway not configured' });
        }

        const plan = planName.toUpperCase();
        const pricing = PLAN_PRICES[plan];
        if (!pricing || pricing.amount === 0) {
            throw new BadRequestException({ code: 'INVALID_PLAN', message: `Plan "${planName}" is not available for self-service checkout` });
        }

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) throw new NotFoundException('Organization not found');

        // Don't allow upgrading to the same plan
        if (org.plan === plan) {
            throw new BadRequestException({ code: 'SAME_PLAN', message: 'You are already on this plan' });
        }

        try {
            const order = await this.razorpay.orders.create({
                amount: pricing.amount,
                currency: 'INR',
                receipt: `s_${orgId.slice(-8)}_${Date.now().toString(36)}`,
                notes: {
                    orgId,
                    plan,
                    type: 'subscription_upgrade',
                },
            });

            return {
                orderId: order.id,
                amount: pricing.amount,
                currency: 'INR',
                planName: plan,
                planLabel: pricing.label,
                razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID'),
            };
        } catch (err: any) {
            this.logger.error('Razorpay order creation failed', err?.error ?? err?.message ?? err);
            throw new BadRequestException({
                code: 'CHECKOUT_FAILED',
                message: err?.error?.description || err?.message || 'Failed to create checkout order',
            });
        }
    }

    /**
     * Verify payment signature and activate the subscription.
     */
    async verifyPayment(orgId: string, body: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        plan: string;
    }) {
        const secret = this.config.get<string>('RAZORPAY_KEY_SECRET', '');

        // Verify the Razorpay signature
        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== body.razorpay_signature) {
            throw new BadRequestException({ code: 'INVALID_SIGNATURE', message: 'Payment verification failed' });
        }

        const plan = body.plan.toUpperCase() as any;
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month subscription

        // Upsert subscription record
        await this.prisma.subscription.upsert({
            where: { orgId },
            create: {
                orgId,
                plan,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                razorpaySubId: body.razorpay_payment_id,
            },
            update: {
                plan,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                razorpaySubId: body.razorpay_payment_id,
            },
        });

        // Update organization plan
        await this.prisma.organization.update({
            where: { id: orgId },
            data: {
                plan,
                planExpiresAt: periodEnd,
            },
        });

        this.logger.log(`Subscription activated: org=${orgId}, plan=${plan}`);

        return { success: true, plan, expiresAt: periodEnd };
    }

    /**
     * Cancel subscription and revert to FREE.
     */
    async cancelSubscription(orgId: string) {
        const sub = await this.prisma.subscription.findUnique({ where: { orgId } });
        if (!sub) {
            throw new NotFoundException({ code: 'NO_SUBSCRIPTION', message: 'No active subscription found' });
        }

        await this.prisma.subscription.update({
            where: { orgId },
            data: { status: 'CANCELLED' },
        });

        await this.prisma.organization.update({
            where: { id: orgId },
            data: { plan: 'FREE', planExpiresAt: null },
        });

        this.logger.log(`Subscription cancelled: org=${orgId}`);

        return { success: true, plan: 'FREE' };
    }

    /**
     * Handle Razorpay subscription webhooks.
     */
    async handleWebhook(rawBody: Buffer, signature: string) {
        const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');

        if (secret) {
            const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
            if (computed !== signature) {
                throw new BadRequestException({ code: 'FORBIDDEN', message: 'Invalid webhook signature' });
            }
        }

        const payload = JSON.parse(rawBody.toString());
        this.logger.log(`[Billing Webhook] Event: ${payload.event}`);

        // Handle subscription-level events
        if (payload.event === 'payment.captured') {
            const entity = payload.payload?.payment?.entity;
            const notes = entity?.notes;
            if (notes?.type === 'subscription_upgrade' && notes?.orgId && notes?.plan) {
                // Auto-activate if webhook arrives before verify (edge case)
                const existingSub = await this.prisma.subscription.findUnique({ where: { orgId: notes.orgId } });
                if (!existingSub || existingSub.status !== 'ACTIVE') {
                    await this.verifyPayment(notes.orgId, {
                        razorpay_order_id: entity.order_id,
                        razorpay_payment_id: entity.id,
                        razorpay_signature: signature,
                        plan: notes.plan,
                    });
                }
            }
        }

        return { received: true };
    }
}
