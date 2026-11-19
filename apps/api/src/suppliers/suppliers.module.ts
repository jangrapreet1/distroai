import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SuppliersImportService } from './suppliers-import.service';
import { SupplierStatementPdfService } from './supplier-statement-pdf.service';

@Module({
    controllers: [SuppliersController],
    providers: [SuppliersService, SuppliersImportService, SupplierStatementPdfService],
    exports: [SuppliersService, SuppliersImportService, SupplierStatementPdfService],
})
export class SuppliersModule { }
