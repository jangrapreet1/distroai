import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateRoleDto, ListUsersQueryDto } from './dto/users.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanLimitGuard } from '../common/guards/plan-limit.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanLimitGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) { }

    @Roles('OWNER', 'ADMIN')
    @Get()
    findAll(@CurrentUser() user: JwtPayload, @Query() query: ListUsersQueryDto) {
        return this.users.findAll(user.orgId, query);
    }

    @Roles('OWNER', 'ADMIN')
    @Post()
    create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
        return this.users.create(user.orgId, dto, 'GROWTH'); // plan from guard in real impl
    }

    @Get(':id')
    findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.users.findOne(user.orgId, id);
    }

    @Patch(':id')
    update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.users.update(user.orgId, id, dto, user.sub, user.role);
    }

    @Roles('OWNER')
    @Delete(':id')
    remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.users.remove(user.orgId, id, user.sub);
    }

    @Roles('OWNER')
    @Patch(':id/role')
    updateRole(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
        return this.users.updateRole(user.orgId, id, dto, user.sub);
    }
}
