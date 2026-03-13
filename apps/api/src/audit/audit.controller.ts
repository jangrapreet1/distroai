import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogService } from './audit.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
@Controller('audit')
export class AuditController {
    constructor(private readonly audit: AuditLogService) { }

    @Get()
    findAll(
        @CurrentUser() u: JwtPayload,
        @Query('entityType') entityType?: string,
        @Query('entityId') entityId?: string,
        @Query('userId') userId?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<any> {
        return this.audit.findAll(u.orgId, { entityType, entityId, userId, dateFrom, dateTo, page: +page, limit: +limit });
    }
}
