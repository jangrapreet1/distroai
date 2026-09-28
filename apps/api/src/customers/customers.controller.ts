import {
    Controller, Get, Post, Patch, Body, Param, Query,
    UseGuards, UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CustomersImportService, CustomerImportRow, CustomerImportOptions } from './customers-import.service';
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersQueryDto, DormantQueryDto } from './dto/customers.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
    constructor(
        private readonly customers: CustomersService,
        private readonly customersImport: CustomersImportService,
    ) { }

    @Post('import/preview')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    previewImport(@CurrentUser() user: JwtPayload, @UploadedFile() file: any) {
        return this.customersImport.parseCustomerExcel(user.orgId, file?.buffer);
    }

    @Post('import/execute')
    executeImport(
        @CurrentUser() user: JwtPayload,
        @Body() body: { rows: CustomerImportRow[]; options?: CustomerImportOptions },
    ) {
        return this.customersImport.executeCustomerImport(user.orgId, body.rows, body.options);
    }

    @Get('import/template')
    downloadTemplate(@Res() res: any) {
        const buffer = this.customersImport.generateCustomerTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="customers-template.xlsx"');
        return res.send(buffer);
    }

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

    @Get(':id/activity')
    getActivity(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query('page') page = 1, @Query('limit') limit = 20) {
        return this.customers.getActivity(user.orgId, id, +page, +limit);
    }

    @Get(':id/credit-score')
    getCreditScore(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.customers.getCreditScore(user.orgId, id); }

    @Post(':id/location-request')
    createLocationRequest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.customers.createLocationRequest(user.orgId, id);
    }
}
