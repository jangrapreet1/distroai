import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TallyService, TallyExportQuery } from './tally.service';

interface TallyConfigBody {
  companyName: string;
  tallySyncEnabled: boolean;
  tallyPort?: number;
}

@ApiTags('tally')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tally')
export class TallyController {
  constructor(private readonly tallyService: TallyService) {}

  @Get('summary')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Get summary counts and totals for Tally export' })
  async getSummary(@CurrentUser() user: any, @Req() req: Request) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    const summary = await this.tallyService.getSummary(orgId);
    return { success: true, data: summary };
  }

  @Get('pending-sync')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Get list of pending unsynced vouchers' })
  async getPendingSync(@CurrentUser() user: any, @Req() req: Request) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    const data = await this.tallyService.getPendingList(orgId);
    return { success: true, data };
  }

  @Get('export/sales-xml')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Download Tally Prime Sales Vouchers XML' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'onlyUnsynced', required: false })
  async exportSalesXML(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query() query: TallyExportQuery,
    @Res() res: Response
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.exportSalesXML(orgId, query, res);
  }

  @Get('export/receipts-xml')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Download Tally Prime Receipt Vouchers XML' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'onlyUnsynced', required: false })
  async exportReceiptsXML(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query() query: TallyExportQuery,
    @Res() res: Response
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.exportReceiptsXML(orgId, query, res);
  }

  @Get('export/combined-xml')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Download All Tally Vouchers (Sales + Receipts) XML' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'onlyUnsynced', required: false })
  async exportCombinedXML(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query() query: TallyExportQuery,
    @Res() res: Response
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.exportCombinedXML(orgId, query, res);
  }

  @Get('export/masters-xml')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Download Tally Masters XML (Customers & Stock Items)' })
  async exportMastersXML(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.exportMastersXML(orgId, res);
  }

  @Get('export/csv')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Download Daybook CSV (Sales or Receipts)' })
  @ApiQuery({ name: 'type', enum: ['sales', 'receipts'] })
  async exportCSV(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('type') type: 'sales' | 'receipts',
    @Query() query: TallyExportQuery,
    @Res() res: Response
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.exportCSV(orgId, type || 'sales', query, res);
  }

  @Post('sync-complete')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Mark vouchers as synced with Tally (legacy)' })
  async markSyncedLegacy(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() body: { invoiceIds?: string[]; paymentIds?: string[] }
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.markSynced(orgId, body);
  }

  @Post('mark-synced')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Mark vouchers as synced with Tally' })
  async markSynced(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() body: { invoiceIds?: string[]; paymentIds?: string[] }
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.markSynced(orgId, body);
  }

  @Post('reset-sync')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Reset sync status for re-exporting' })
  async resetSync(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() body: { invoiceIds?: string[]; paymentIds?: string[] }
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    return this.tallyService.resetSync(orgId, body);
  }

  @Get('config')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get Tally integration configuration' })
  async getConfig(@CurrentUser() user: any, @Req() req: Request) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    const config = await this.tallyService.getConfig(orgId);
    return { success: true, data: config };
  }

  @Post('config')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Save Tally integration configuration' })
  async saveConfig(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() body: TallyConfigBody
  ) {
    const orgId = user?.orgId || (req.user as any)?.orgId;
    await this.tallyService.saveConfig(orgId, body);
    return { success: true };
  }
}
