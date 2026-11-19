import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsImportService } from './products-import.service';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [
        MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }),
        AiModule
    ],
    controllers: [ProductsController],
    providers: [ProductsService, ProductsImportService],
    exports: [ProductsService, ProductsImportService],
})
export class ProductsModule { }
