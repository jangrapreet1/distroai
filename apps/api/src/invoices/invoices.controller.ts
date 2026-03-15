import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService, CreateInvoiceDto, SendInvoiceDto, GstrQueryDto } from './invoices.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
    constructor(private readonly invoices: InvoicesService) { }
    @Get() findAll(@CurrentUser() u: JwtPayload, @Query('status') s?: string, @Query('customerId') c?: string, @Query('page') p = 1, @Query('limit') l = 20) { return this.invoices.findAll(u.orgId, s, c, +p, +l); }
    @Post() create(@CurrentUser() u: JwtPayload, @Body() dto: CreateInvoiceDto) { return this.invoices.create(u.orgId, dto); }
    @Get('gstr1') getGstr1(@CurrentUser() u: JwtPayload, @Query() q: GstrQueryDto) { return this.invoices.getGstr1(u.orgId, q.from, q.to); }
    @Get(':id') findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.findOne(u.orgId, id); }
    @Post(':id/send') send(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: SendInvoiceDto) { return this.invoices.send(u.orgId, id, dto.channels); }
    @Post(':id/pdf') pdf(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.generatePdf(u.orgId, id); }
    @Post(':id/e-invoice') eInvoice(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.eInvoice(u.orgId, id); }
    @Post(':id/e-waybill') eWaybill(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.eWaybill(u.orgId, id); }
    @Post(':id/payment-link') paymentLink(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.createPaymentLink(u.orgId, id); }
}
