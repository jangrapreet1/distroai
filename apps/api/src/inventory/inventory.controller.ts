import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto, TransferInventoryDto, ListTransactionsQueryDto, InventoryQueryDto } from './dto/inventory.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
    constructor(private readonly inventory: InventoryService) { }

    @Get()
    findAll(@CurrentUser() user: JwtPayload, @Query() query: InventoryQueryDto) {
        return this.inventory.findAll(user.orgId, query);
    }

    @Get('warehouses')
    getWarehouses(@CurrentUser() user: JwtPayload) {
        return this.inventory.getWarehouses(user.orgId);
    }

    @Roles('OWNER', 'ADMIN', 'MANAGER')
    @Post('adjust')
    adjust(@CurrentUser() user: JwtPayload, @Body() dto: AdjustInventoryDto) {
        return this.inventory.adjust(user.orgId, dto, user.sub);
    }

    @Post('transfer')
    transfer(@CurrentUser() user: JwtPayload, @Body() dto: TransferInventoryDto) {
        return this.inventory.transfer(user.orgId, dto, user.sub);
    }

    @Get('transactions')
    getTransactions(@CurrentUser() user: JwtPayload, @Query() query: ListTransactionsQueryDto) {
        return this.inventory.getTransactions(user.orgId, query);
    }

    @Get('valuation')
    getValuation(@CurrentUser() user: JwtPayload) {
        return this.inventory.getValuation(user.orgId);
    }
}
