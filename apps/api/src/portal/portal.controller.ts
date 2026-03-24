import { Controller, Get, Post, Body, Param, UseGuards, Request, UnauthorizedException, Headers } from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtService } from '@nestjs/jwt';

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
        @Body() body: any
    ) {
        const customerId = this.extractCustomerId(auth);

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
}
