import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanLimitGuard } from '../common/guards/plan-limit.guard';
import { RequiresFeature } from '../common/decorators/plan.decorator';
import { IsString, IsOptional } from 'class-validator';
import { Req } from '@nestjs/common';
import { PLAN_LIMITS, PlanName } from '../common/config/plan-limits.config';

class SalesQueryDto { @IsString() from!: string; @IsString() to!: string; @IsOptional() @IsString() groupBy?: string; }

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanLimitGuard)
@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analytics: AnalyticsService) { }
    @Get('dashboard') getDashboard(@CurrentUser() u: JwtPayload) { return this.analytics.getDashboard(u.orgId); }
    @Get('sales')
    getSales(@CurrentUser() u: JwtPayload, @Query() q: SalesQueryDto, @Req() req: any) {
        const plan = req.org?.plan as PlanName;
        const hasAdvanced = plan && PLAN_LIMITS[plan]?.features?.advancedAnalytics;

        let from = q.from;
        let to = q.to;
        let groupBy = q.groupBy ?? 'day';

        if (!hasAdvanced) {
            // Freemium Clamp: Force max 30 days and daily grouping
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - 30);
            from = fromDate.toISOString().split('T')[0];
            to = toDate.toISOString().split('T')[0];
            groupBy = 'day';
        }

        return this.analytics.getSales(u.orgId, from, to, groupBy);
    }

    @RequiresFeature('advancedAnalytics')
    @Get('collections') getCollections(@CurrentUser() u: JwtPayload, @Query('from') f: string, @Query('to') t: string) { return this.analytics.getCollections(u.orgId, f, t); }
}
