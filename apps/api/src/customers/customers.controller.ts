import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersQueryDto, DormantQueryDto } from './dto/customers.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
    constructor(private readonly customers: CustomersService) { }

    @Get()
    findAll(@CurrentUser() user: JwtPayload, @Query() query: ListCustomersQueryDto) { return this.customers.findAll(user.orgId, query); }

    @Post()
    create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCustomerDto) { return this.customers.create(user.orgId, dto); }

    @Get('dormant')
    getDormant(@CurrentUser() user: JwtPayload, @Query() query: DormantQueryDto) { return this.customers.getDormant(user.orgId, query); }

    @Get('high-risk')
    getHighRisk(@CurrentUser() user: JwtPayload) { return this.customers.getHighRisk(user.orgId); }

    @Get(':id')
    findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.customers.findOne(user.orgId, id); }

    @Patch(':id')
    update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.customers.update(user.orgId, id, dto); }

    @Get(':id/orders')
    getOrders(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query('page') page = 1, @Query('limit') limit = 20) {
        return this.customers.getOrders(user.orgId, id, +page, +limit);
    }

    @Get(':id/payments')
    getPayments(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.customers.getPayments(user.orgId, id); }

    @Get(':id/credit-score')
    getCreditScore(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.customers.getCreditScore(user.orgId, id); }
}
