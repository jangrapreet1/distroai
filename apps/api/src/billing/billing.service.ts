import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// Plan pricing in paise (Razorpay uses smallest currency unit)
const PLAN_PRICES: Record<string, { amount: number; label: string; annualAmount: number; annualLabel: string }> = {
    STARTER: { amount: 49900, label: 'Starter — ₹499/mo', annualAmount: 499000, annualLabel: 'Starter — ₹4,990/yr' },
    GROWTH: { amount: 89900, label: 'Growth — ₹899/mo', annualAmount: 899000, annualLabel: 'Growth — ₹8,990/yr' },
    ENTERPRISE: { amount: 0, label: 'Enterprise — Custom', annualAmount: 0, annualLabel: 'Enterprise — Custom' },
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
    async createCheckoutOrder(orgId: string, planName: string, isAnnual: boolean = false) {
        if (!this.razorpay) {
            throw new BadRequestException({ code: 'BILLING_DISABLED', message: 'Payment gateway not configured' });
        }

        const plan = planName.toUpperCase();
        const pricing = PLAN_PRICES[plan];
        const priceAmount = isAnnual ? pricing.annualAmount : pricing.amount;
        if (!pricing || priceAmount === 0) {
            throw new BadRequestException({ code: 'INVALID_PLAN', message: `Plan "${planName}" is not available for self-service checkout` });
        }

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) throw new NotFoundException('Organization not found');

        // Don't allow upgrading to the same plan
        if (org.plan === plan) {
            throw new BadRequestException({ code: 'SAME_PLAN', message: 'You are already on this plan' });
        }

        try {
            let planId = '';
            if (plan === 'STARTER') {
                planId = (isAnnual ? this.config.get<string>('RAZORPAY_PLAN_STARTER_ANNUAL') : this.config.get<string>('RAZORPAY_PLAN_STARTER_MONTHLY')) || '';
            } else if (plan === 'GROWTH') {
                planId = (isAnnual ? this.config.get<string>('RAZORPAY_PLAN_GROWTH_ANNUAL') : this.config.get<string>('RAZORPAY_PLAN_GROWTH_MONTHLY')) || '';
            }

            if (!planId) {
                throw new BadRequestException({ code: 'MISSING_PLAN_ID', message: `Razorpay plan ID for ${plan} is not configured in .env.` });
            }

            const subscription = await this.razorpay.subscriptions.create({
                plan_id: planId,
                total_count: isAnnual ? 10 : 120, // Allow up to 10 years of auto-pay
                customer_notify: 1,
                notes: {
                    orgId,
                    plan,
                    type: 'subscription_upgrade',
                    isAnnual: isAnnual ? 'true' : 'false',
                },
            });

            return {
                orderId: subscription.id, // Frontend uses 'orderId' variable, returning sub_ ID here works as Razorpay JS accepts subscription_id or order_id
                subscriptionId: subscription.id,
                amount: priceAmount,
                currency: 'INR',
                planName: plan,
                planLabel: isAnnual ? pricing.annualLabel : pricing.label,
                razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID'),
            };
        } catch (err: any) {
            this.logger.error('Razorpay subscription creation failed', err?.error ?? err?.message ?? err);
            throw new BadRequestException({
                code: 'CHECKOUT_FAILED',
                message: err?.error?.description || err?.message || 'Failed to create checkout subscription',
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
        isAnnual?: boolean;
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
        const isAnnual = body.isAnnual ?? false;
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + (isAnnual ? 12 : 1)); // 1 or 12 month subscription

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
        if (payload.event === 'subscription.charged') {
            const entity = payload.payload?.subscription?.entity;
            const notes = entity?.notes;
            if (notes?.type === 'subscription_upgrade' && notes?.orgId && notes?.plan) {
                // Determine if this is first payment (verifyPayment might be called by frontend too)
                const existingSub = await this.prisma.subscription.findUnique({ where: { orgId: notes.orgId } });
                
                const isAnnual = notes.isAnnual === 'true';
                const periodEnd = new Date(entity.current_end * 1000); // Unix timestamp to JS Date

                await this.prisma.subscription.upsert({
                    where: { orgId: notes.orgId },
                    create: {
                        orgId: notes.orgId,
                        plan: notes.plan as any,
                        status: 'ACTIVE',
                        currentPeriodStart: new Date(entity.current_start * 1000),
                        currentPeriodEnd: periodEnd,
                        razorpaySubId: entity.id,
                    },
                    update: {
                        status: 'ACTIVE',
                        currentPeriodStart: new Date(entity.current_start * 1000),
                        currentPeriodEnd: periodEnd,
                    },
                });

                await this.prisma.organization.update({
                    where: { id: notes.orgId },
                    data: {
                        plan: notes.plan as any,
                        planExpiresAt: periodEnd,
                    },
                });
            }
        } else if (payload.event === 'subscription.halted' || payload.event === 'subscription.cancelled') {
            const entity = payload.payload?.subscription?.entity;
            const notes = entity?.notes;
            if (notes?.orgId) {
                await this.cancelSubscription(notes.orgId).catch(() => {});
            }
        }

        return { received: true };
    }
}
