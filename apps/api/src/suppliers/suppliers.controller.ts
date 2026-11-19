import {
    Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res,
    UseInterceptors, UploadedFile, Optional
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import { SuppliersService, CreateSupplierDto, UpdateSupplierDto } from './suppliers.service';
import { SuppliersImportService, SupplierImportRow } from './suppliers-import.service';
import { SupplierStatementQueryDto } from './dto/supplier-statement-query.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
    constructor(
        private readonly suppliers: SuppliersService,
        @Optional() private readonly importService?: SuppliersImportService,
    ) { }

    @Get(':id/import/template')
    @ApiOperation({ summary: 'Download Supplier Purchases & Statement Excel template' })
    async getSupplierTemplate(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        const supplierResult = await this.suppliers.findOne(u.orgId, id);
        const supplierName = (supplierResult as any)?.supplier?.name || (supplierResult as any)?.name || 'Vendor';
        const buffer = this.importService
            ? this.importService.generateSupplierTemplate(supplierName)
            : Buffer.from([]);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="supplier_purchases_${id}.xlsx"`);
        res.setHeader('Content-Length', buffer.length);
        return res.end(buffer);
    }

    @Post(':id/import/preview')
    @ApiOperation({ summary: 'Preview and validate Supplier purchases spreadsheet' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    previewPurchases(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @UploadedFile() file: any,
    ) {
        if (!this.importService) throw new Error('Supplier import service not available');
        return this.importService.previewSupplierPurchases(u.orgId, id, file.buffer);
    }

    @Post(':id/import/execute')
    @ApiOperation({ summary: 'Execute batch import of Supplier purchases and payments' })
    executePurchases(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Body() body: { rows: SupplierImportRow[]; options?: { updateInventory?: boolean } },
    ) {
        if (!this.importService) throw new Error('Supplier import service not available');
        return this.importService.executeSupplierPurchasesImport(u.orgId, id, body.rows, body.options);
    }

    @Get()
    findAll(@CurrentUser() u: JwtPayload, @Query('page') p = 1, @Query('limit') l = 20) {
        return this.suppliers.findAll(u.orgId, +p, +l);
    }

    @Post()
    create(@CurrentUser() u: JwtPayload, @Body() dto: CreateSupplierDto) {
        return this.suppliers.create(u.orgId, dto);
    }

    @Get(':id')
    findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
        return this.suppliers.findOne(u.orgId, id);
    }

    @Patch(':id')
    update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
        return this.suppliers.update(u.orgId, id, dto);
    }

    @Get(':id/statement')
    @ApiOperation({ summary: 'Get structured 8-column Supplier Account Summary data' })
    @ApiResponse({ status: 200, description: 'Supplier statement data successfully retrieved' })
    getStatement(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Query() query: SupplierStatementQueryDto,
    ) {
        return this.suppliers.getStatementData(u.orgId, id, query);
    }

    @Get(':id/statement/pdf')
    @ApiOperation({ summary: 'Download 8-Column Supplier Account Summary PDF' })
    @ApiResponse({ status: 200, description: 'PDF stream' })
    async downloadStatementPdf(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Query() query: SupplierStatementQueryDto,
        @Res() res: Response,
    ) {
        const pdfBuffer = await this.suppliers.generateStatementPdf(u.orgId, id, query);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="supplier-statement-${id}.pdf"`,
            'Content-Length': String(pdfBuffer.length),
        });
        res.end(pdfBuffer);
    }

    @Post(':id/payments')
    @ApiOperation({ summary: 'Record payment made to a supplier' })
    @ApiResponse({ status: 201, description: 'Supplier payment recorded' })
    recordPayment(
        @CurrentUser() u: JwtPayload,
        @Param('id') id: string,
        @Body() dto: RecordSupplierPaymentDto,
    ) {
        return this.suppliers.recordPayment(u.orgId, id, dto, u.sub);
    }
}
