import { Controller, Get, Post, Body, Param, UseGuards, Request, UnauthorizedException, Headers, BadRequestException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';

const PlaceOrderSchema = z.object({
    paymentMethod: z.enum(['LEDGER', 'RAZORPAY']),
    guestName: z.string().optional(),
    guestPhone: z.string().optional(),
    guestAddress: z.string().optional(),
    utmCampaignId: z.string().optional(),
    items: z.array(
        z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().nonnegative()
        })
    ).min(1, "Order must contain at least one item")
});

@Controller('portal/:orgId')
export class PortalController {
    constructor(
        private readonly portalService: PortalService,
        private jwtService: JwtService
    ) { }

    // Utility to get customer ID from a potentially present Bearer token
    private extractCustomerId(authHeader?: string): string | undefined {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
        try {
            const token = authHeader.split(' ')[1];
            const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
            return payload.type === 'portal' ? payload.sub : undefined;
        } catch {
            return undefined;
        }
    }

    @Get('storefront')
    getStorefront(@Param('orgId') orgId: string) {
        return this.portalService.getStorefrontInfo(orgId);
    }

    @Get('catalog')
    getCatalog(
        @Param('orgId') orgId: string,
        @Headers('authorization') auth?: string
    ) {
        const customerId = this.extractCustomerId(auth);
        return this.portalService.getCatalog(orgId, customerId);
    }

    @Post('auth/request-otp')
    requestOTP(
        @Param('orgId') orgId: string,
        @Body() body: { phone: string }
    ) {
        return this.portalService.requestOTP(orgId, body.phone);
    }

    @Post('auth/verify-otp')
    verifyOTP(
        @Param('orgId') orgId: string,
        @Body() body: { phone: string, otp: string }
    ) {
        return this.portalService.verifyOTP(orgId, body.phone, body.otp);
    }

    @Post('orders')
    placeOrder(
        @Param('orgId') orgId: string,
        @Headers('authorization') auth: string,
        @Body() rawBody: any
    ) {
        const customerId = this.extractCustomerId(auth);

        // Zod Validation
        const result = PlaceOrderSchema.safeParse(rawBody);
        if (!result.success) {
            throw new BadRequestException({
                message: "Invalid order data",
                errors: result.error.issues
            });
        }
        const body = result.data;

        // If B2B (Ledger payment), they MUST be logged in
        if (body.paymentMethod === 'LEDGER' && !customerId) {
            throw new UnauthorizedException('You must be a registered retailer to buy on credit.');
        }

        return this.portalService.placeOrder(orgId, customerId || null, body);
    }

    @Get('ledger')
    getLedger(
        @Param('orgId') orgId: string,
        @Headers('authorization') auth: string
    ) {
        const customerId = this.extractCustomerId(auth);
        if (!customerId) throw new UnauthorizedException('You must be logged in to view your ledger');
        return this.portalService.getLedger(orgId, customerId);
    }

    @Get('orders')
    getOrders(
        @Param('orgId') orgId: string,
        @Headers('authorization') auth: string
    ) {
        const customerId = this.extractCustomerId(auth);
        if (!customerId) throw new UnauthorizedException('You must be logged in to view orders');
        return this.portalService.getOrders(orgId, customerId);
    }

    @Get('orders/:orderId')
    getOrderDetail(
        @Param('orgId') orgId: string,
        @Param('orderId') orderId: string,
        @Headers('authorization') auth: string
    ) {
        const customerId = this.extractCustomerId(auth);
        if (!customerId) throw new UnauthorizedException('You must be logged in to view order details');
        return this.portalService.getOrderDetail(orgId, customerId, orderId);
    }

    @Get('reorder/:orderId')
    getReorderItems(
        @Param('orgId') orgId: string,
        @Param('orderId') orderId: string,
        @Headers('authorization') auth: string
    ) {
        const customerId = this.extractCustomerId(auth);
        if (!customerId) throw new UnauthorizedException('You must be logged in to reorder');
        return this.portalService.getReorderItems(orgId, customerId, orderId);
    }
}
