import { Controller, Post, Body, Req, Headers, UseGuards, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
    constructor(private readonly billing: BillingService) { }

    @Post('checkout')
    async checkout(@CurrentUser() u: JwtPayload, @Body() body: { plan: string; isAnnual?: boolean }) {
        return this.billing.createCheckoutOrder(u.orgId, body.plan, body.isAnnual);
    }

    @Post('verify')
    async verify(@CurrentUser() u: JwtPayload, @Body() body: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        plan: string;
        isAnnual?: boolean;
    }) {
        return this.billing.verifyPayment(u.orgId, body);
    }

    @Post('cancel')
    async cancel(@CurrentUser() u: JwtPayload) {
        return this.billing.cancelSubscription(u.orgId);
    }

    @Public()
    @Post('webhook')
    async webhook(@Req() req: RawBodyRequest<Request>, @Headers('razorpay-signature') sig: string) {
        return this.billing.handleWebhook(req.rawBody ?? Buffer.alloc(0), sig);
    }
}
