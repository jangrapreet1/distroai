import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { InvoicesService, CreateInvoiceDto, SendInvoiceDto, GstrQueryDto, GenerateEWayBillDto } from './invoices.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateInvoicePdfDto, InvoiceCustomOptionsDto } from './dto/custom-invoice-options.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
    constructor(private readonly invoices: InvoicesService) { }
    @Get() findAll(@CurrentUser() u: JwtPayload, @Query('status') s?: string, @Query('customerId') c?: string, @Query('page') p = 1, @Query('limit') l = 20) { return this.invoices.findAll(u.orgId, s, c, +p, +l); }
    @Post() create(@CurrentUser() u: JwtPayload, @Body() dto: CreateInvoiceDto) { return this.invoices.create(u.orgId, dto); }
    @Post('reconcile') reconcile(@CurrentUser() u: JwtPayload) { return this.invoices.reconcile(u.orgId); }
    @Get('gstr1') getGstr1(@CurrentUser() u: JwtPayload, @Query() q: GstrQueryDto) { return this.invoices.getGstr1(u.orgId, q.from, q.to); }

    @Get('gstr1/json')
    @ApiOperation({ summary: 'Download GSTR-1 JSON compliant with GST portal offline tool' })
    async getGstr1Json(@CurrentUser() u: JwtPayload, @Query() q: GstrQueryDto, @Res() res: Response) {
        const { filename, data } = await this.invoices.getGstr1Json(u.orgId, q.from, q.to);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(data, null, 2));
    }

    @Get('gstr1/csv')
    @ApiOperation({ summary: 'Download GSTR-1 Summary CSV for Accountants and CAs' })
    async getGstr1Csv(@CurrentUser() u: JwtPayload, @Query() q: GstrQueryDto, @Res() res: Response) {
        const { filename, csv } = await this.invoices.getGstr1Csv(u.orgId, q.from, q.to);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    }

    @Get('credit-notes') findCreditNotes(@CurrentUser() u: JwtPayload) { return this.invoices.findCreditNotes(u.orgId); }
    @Get(':id') findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.findOne(u.orgId, id); }
    @Post(':id/send') send(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: SendInvoiceDto) { return this.invoices.send(u.orgId, id, dto.channels); }
    
    @Post(':id/pdf')
    @ApiOperation({ summary: 'Generate Invoice PDF (queued with custom options)' })
    pdf(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto?: GenerateInvoicePdfDto) {
        return this.invoices.generatePdf(u.orgId, id, dto?.options, dto?.saveAsDefault);
    }

    @Get(':id/pdf/stream')
    @ApiOperation({ summary: 'Stream custom invoice PDF directly' })
    async streamPdf(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Query() q: any,
        @Res() res: Response,
    ) {
        const options = {
            ...q,
            ...(q.showGstNumber !== undefined && { showGstNumber: q.showGstNumber === 'true' || q.showGstNumber === true }),
            ...(q.showPanNumber !== undefined && { showPanNumber: q.showPanNumber === 'true' || q.showPanNumber === true }),
            ...(q.showHsnCode !== undefined && { showHsnCode: q.showHsnCode === 'true' || q.showHsnCode === true }),
            ...(q.showDiscountCol !== undefined && { showDiscountCol: q.showDiscountCol === 'true' || q.showDiscountCol === true }),
            ...(q.showTaxBreakup !== undefined && { showTaxBreakup: q.showTaxBreakup === 'true' || q.showTaxBreakup === true }),
            ...(q.showShipTo !== undefined && { showShipTo: q.showShipTo === 'true' || q.showShipTo === true }),
            ...(q.showBankDetails !== undefined && { showBankDetails: q.showBankDetails === 'true' || q.showBankDetails === true }),
            ...(q.showUpiQr !== undefined && { showUpiQr: q.showUpiQr === 'true' || q.showUpiQr === true }),
            ...(q.showTerms !== undefined && { showTerms: q.showTerms === 'true' || q.showTerms === true }),
            ...(q.showSignatory !== undefined && { showSignatory: q.showSignatory === 'true' || q.showSignatory === true }),
        };
        const { buffer, filename } = await this.invoices.streamPdf(u.orgId, id, options);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    }

    @Post(':id/pdf/stream')
    @ApiOperation({ summary: 'Stream custom invoice PDF directly using POST body options' })
    async streamPdfPost(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Body() body: { options?: InvoiceCustomOptionsDto },
        @Res() res: Response,
    ) {
        const { buffer, filename } = await this.invoices.streamPdf(u.orgId, id, body?.options);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    }

    @Patch(':id/custom-options')
    @ApiOperation({ summary: 'Update custom invoice layout options' })
    updateCustomOptions(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Body() dto: InvoiceCustomOptionsDto,
    ) {
        return this.invoices.updateCustomOptions(u.orgId, id, dto);
    }

    @Post(':id/e-invoice') eInvoice(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.eInvoice(u.orgId, id); }
    @Post(':id/e-waybill') eWaybill(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: GenerateEWayBillDto) { return this.invoices.eWaybill(u.orgId, id, dto); }
    @Post(':id/payment-link') paymentLink(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.createPaymentLink(u.orgId, id); }
    @Get(':id/credit-notes') findInvoiceCreditNotes(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.invoices.findCreditNotes(u.orgId, id); }
}
