import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsOptional } from 'class-validator';

class SalesQueryDto { @IsString() from!: string; @IsString() to!: string; @IsOptional() @IsString() groupBy?: string; }

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analytics: AnalyticsService) { }
    @Get('dashboard') getDashboard(@CurrentUser() u: JwtPayload) { return this.analytics.getDashboard(u.orgId); }
    @Get('sales') getSales(@CurrentUser() u: JwtPayload, @Query() q: SalesQueryDto) { return this.analytics.getSales(u.orgId, q.from, q.to, q.groupBy ?? 'day'); }
    @Get('collections') getCollections(@CurrentUser() u: JwtPayload, @Query('from') f: string, @Query('to') t: string) { return this.analytics.getCollections(u.orgId, f, t); }
}
