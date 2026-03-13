import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrdersService, CreatePurchaseOrderDto, ReceivePODto } from './purchase-orders.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
    constructor(private readonly pos: PurchaseOrdersService) { }
    @Get() findAll(@CurrentUser() u: JwtPayload, @Query('page') p = 1, @Query('limit') l = 20) { return this.pos.findAll(u.orgId, +p, +l); }
    @Post() create(@CurrentUser() u: JwtPayload, @Body() dto: CreatePurchaseOrderDto) { return this.pos.create(u.orgId, dto, u.sub); }
    @Get(':id') findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.pos.findOne(u.orgId, id); }
    @Post(':id/receive') receive(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ReceivePODto) { return this.pos.receive(u.orgId, id, dto, u.sub); }
}
