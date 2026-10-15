import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { SuppliersService, CreateSupplierDto } from './suppliers.service';
import { SupplierStatementQueryDto } from './dto/supplier-statement-query.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
    constructor(private readonly suppliers: SuppliersService) { }

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
    update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: Partial<CreateSupplierDto>) {
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
