import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierStatementPdfService } from './supplier-statement-pdf.service';

@Module({
    controllers: [SuppliersController],
    providers: [SuppliersService, SupplierStatementPdfService],
    exports: [SuppliersService, SupplierStatementPdfService],
})
export class SuppliersModule { }
