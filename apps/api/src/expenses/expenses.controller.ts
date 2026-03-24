import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) { }

    @Get()
    findAll(
        @CurrentUser() u: JwtPayload,
        @Query('status') status?: string,
        @Query('category') category?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20
    ) {
        return this.expensesService.findAll(u.orgId, { status, category, page: +page, limit: +limit });
    }

    @Post()
    create(@CurrentUser() u: JwtPayload, @Body() createDto: any) {
        return this.expensesService.create(u.orgId, createDto);
    }

    @Patch(':id/status')
    updateStatus(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() body: { status: string }) {
        return this.expensesService.updateStatus(u.orgId, id, body.status);
    }

    @Delete(':id')
    remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
        return this.expensesService.remove(u.orgId, id);
    }

    @Post('scan')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
    }))
    async scanReceipt(@CurrentUser() u: JwtPayload, @UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        return this.expensesService.scanReceipt(u.orgId, file);
    }
}
