import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrgService, UpdateOrgDto, UpdateSettingsDto } from './org.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('org')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('org')
export class OrgController {
    constructor(private readonly org: OrgService) { }
    @Get() getOrg(@CurrentUser() u: JwtPayload) { return this.org.getOrg(u.orgId); }
    @Roles('OWNER') @Patch() updateOrg(@CurrentUser() u: JwtPayload, @Body() dto: UpdateOrgDto) { return this.org.updateOrg(u.orgId, dto); }
    @Get('settings') getSettings(@CurrentUser() u: JwtPayload) { return this.org.getSettings(u.orgId); }
    @Roles('OWNER') @Patch('settings') updateSettings(@CurrentUser() u: JwtPayload, @Body() dto: UpdateSettingsDto) { return this.org.updateSettings(u.orgId, dto); }
    @Get('subscription') getSubscription(@CurrentUser() u: JwtPayload) { return this.org.getSubscription(u.orgId); }
}
