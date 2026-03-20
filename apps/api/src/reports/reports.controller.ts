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
