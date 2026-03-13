import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService, CreateSupplierDto } from './suppliers.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
    constructor(private readonly suppliers: SuppliersService) { }
    @Get() findAll(@CurrentUser() u: JwtPayload, @Query('page') p = 1, @Query('limit') l = 20) { return this.suppliers.findAll(u.orgId, +p, +l); }
    @Post() create(@CurrentUser() u: JwtPayload, @Body() dto: CreateSupplierDto) { return this.suppliers.create(u.orgId, dto); }
    @Get(':id') findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.suppliers.findOne(u.orgId, id); }
    @Patch(':id') update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: Partial<CreateSupplierDto>) { return this.suppliers.update(u.orgId, id, dto); }
}
