import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    // ─── P&L Report ─────────────────────────────────
    @Get('pnl')
    @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
    @ApiOperation({ summary: 'Get Profit & Loss report for a date range' })
    async getProfitAndLoss(
        @CurrentUser() user: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.getProfitAndLoss(user.orgId, startDate, endDate);
    }

    // ─── Aging Report ───────────────────────────────
    @Get('aging')
    @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'MANAGER')
    @ApiOperation({ summary: 'Get invoice aging report with per-customer breakdown' })
    async getAgingReport(@CurrentUser() user: any) {
        return this.reportsService.getAgingReport(user.orgId);
    }

    // ─── Salesman Commissions ───────────────────────
    @Get('commissions')
    @Roles('OWNER', 'ADMIN')
    @ApiOperation({ summary: 'Get salesman commission report for a month (owner/admin only)' })
    async getSalesmanCommissions(
        @CurrentUser() user: any,
        @Query('month') month: string,
        @Query('year') year: string,
    ) {
        const m = parseInt(month, 10) || new Date().getMonth() + 1;
        const y = parseInt(year, 10) || new Date().getFullYear();
        return this.reportsService.getSalesmanCommissions(user.orgId, m, y);
    }

    // ─── GST CA Export ──────────────────────────────
    @Get('ca-export')
    @Roles('OWNER', 'MANAGER', 'ACCOUNTANT')
    @ApiOperation({ summary: 'Export exact month GST data for Chartered Accountant' })
    @ApiQuery({ name: 'month', required: true, description: '1-12' })
    @ApiQuery({ name: 'year', required: true, description: 'YYYY' })
    async exportCaGstData(
        @CurrentUser() user: any,
        @Query('month') month: string,
        @Query('year') year: string,
        @Res() res: Response
    ) {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        return this.reportsService.streamCaGstExport(user.orgId, m, y, res);
    }
}
