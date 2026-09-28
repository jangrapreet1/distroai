import {
    Controller, Get, Post, Patch, Body, Param, Query,
    UseGuards, UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { OrdersImportService, GroupedImportOrder, OrderImportLineRow } from './orders-import.service';
import { CreateOrderDto, UpdateDraftOrderDto, ReturnOrderDto, DispatchOrderDto, ListOrdersQueryDto, MarkPaidDto } from './dto/orders.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    constructor(
        private readonly orders: OrdersService,
        private readonly ordersImport: OrdersImportService,
    ) { }

    @Post('import/preview')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    previewImport(@CurrentUser() u: JwtPayload, @UploadedFile() file: any) {
        return this.ordersImport.parseOrderExcel(u.orgId, file?.buffer);
    }

    @Post('import/execute')
    async executeImport(
        @CurrentUser() u: JwtPayload,
        @Body() body: { orders?: GroupedImportOrder[]; rows?: OrderImportLineRow[]; options?: any },
    ) {
        let ordersToImport = body.orders;
        if ((!ordersToImport || ordersToImport.length === 0) && body.rows) {
            ordersToImport = await this.ordersImport.groupOrderRows(u.orgId, body.rows);
        }
        return this.ordersImport.executeOrderImport(u.orgId, ordersToImport || [], u.sub);
    }

    @Get('import/template')
    downloadTemplate(@Res() res: any) {
        const buffer = this.ordersImport.generateOrderTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="orders-template.xlsx"');
        return res.send(buffer);
    }

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
