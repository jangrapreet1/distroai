import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query,
    UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto, ExpiringQueryDto } from './dto/products.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
    constructor(private readonly products: ProductsService) { }

    @Get()
    findAll(@CurrentUser() user: JwtPayload, @Query() query: ListProductsQueryDto) {
        return this.products.findAll(user.orgId, query);
    }

    @Post()
    create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
        return this.products.create(user.orgId, dto);
    }

    @Post('import')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    bulkImport(@CurrentUser() user: JwtPayload, @UploadedFile() file: any) {
        return this.products.bulkImport(user.orgId, file.buffer);
    }

    @Get('low-stock')
    getLowStock(@CurrentUser() user: JwtPayload) {
        return this.products.getLowStock(user.orgId);
    }

    @Get('expiring')
    getExpiring(@CurrentUser() user: JwtPayload, @Query() query: ExpiringQueryDto) {
        return this.products.getExpiring(user.orgId, query);
    }

    @Get(':id')
    findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.products.findOne(user.orgId, id);
    }

    @Patch(':id')
    update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProductDto) {
        return this.products.update(user.orgId, id, dto);
    }

    @Delete(':id')
    remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.products.remove(user.orgId, id);
    }

    @Post(':id/restore')
    restore(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.products.restore(user.orgId, id);
    }

    @Delete(':id/hard')
    hardDelete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.products.hardDelete(user.orgId, id);
    }
}
