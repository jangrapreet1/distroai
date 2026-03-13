import { Controller, Get, Post, Body, Query, Headers, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
    constructor(private readonly payments: PaymentsService) { }

    @Get() findAll(@CurrentUser() u: JwtPayload, @Query('customerId') c?: string, @Query('method') m?: string, @Query('status') s?: string, @Query('page') p = 1, @Query('limit') l = 20) {
        return this.payments.findAll(u.orgId, { customerId: c, method: m, status: s, page: +p, limit: +l });
    }
    @Post() create(@CurrentUser() u: JwtPayload, @Body() dto: CreatePaymentDto) { return this.payments.create(u.orgId, dto); }

    @Public()
    @Post('razorpay-webhook')
    handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('razorpay-signature') sig: string) {
        return this.payments.handleRazorpayWebhook(req.rawBody ?? Buffer.alloc(0), sig);
    }

    @Get('outstanding') getOutstanding(@CurrentUser() u: JwtPayload) { return this.payments.getOutstanding(u.orgId); }
    @Get('collection-plan') getCollectionPlan(@CurrentUser() u: JwtPayload) { return this.payments.getCollectionPlan(u.orgId); }
}
