import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateDraftOrderDto, ReturnOrderDto, DispatchOrderDto, ListOrdersQueryDto, MarkPaidDto } from './dto/orders.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    constructor(private readonly orders: OrdersService) { }
    @Get() findAll(@CurrentUser() u: JwtPayload, @Query() q: ListOrdersQueryDto) { return this.orders.findAll(u.orgId, q); }
    @Post() create(@CurrentUser() u: JwtPayload, @Body() dto: CreateOrderDto) { return this.orders.create(u.orgId, dto, u.sub); }
    @Get(':id') findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.orders.findOne(u.orgId, id); }
    @Patch(':id') updateDraft(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDraftOrderDto) { return this.orders.updateDraft(u.orgId, id, dto); }
    @Post(':id/confirm') confirm(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.orders.confirm(u.orgId, id, u.sub); }
    @Post(':id/pack') pack(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.orders.pack(u.orgId, id, u.sub); }
    @Post(':id/dispatch') dispatch(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: DispatchOrderDto) { return this.orders.dispatch(u.orgId, id, dto, u.sub); }
    @Post(':id/deliver') deliver(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.orders.deliver(u.orgId, id, u.sub); }
    @Post(':id/cancel') cancel(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.orders.cancel(u.orgId, id, u.sub); }
    @Post(':id/return') returnOrder(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ReturnOrderDto) { return this.orders.returnOrder(u.orgId, id, dto, u.sub); }
    @Post(':id/mark-paid') markPaid(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: MarkPaidDto) { return this.orders.markPaid(u.orgId, id, u.sub, dto.method); }
}
