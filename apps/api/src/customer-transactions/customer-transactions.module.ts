import { Module } from '@nestjs/common';
import { CustomerTransactionsController } from './customer-transactions.controller';
import { CustomerTransactionsService } from './customer-transactions.service';
import { CustomerTransactionsImportService } from './customer-transactions-import.service';
import { RtkStatementPdfService } from './rtk-statement-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
  ],
  controllers: [CustomerTransactionsController],
  providers: [
    CustomerTransactionsService,
    CustomerTransactionsImportService,
    RtkStatementPdfService,
  ],
  exports: [
    CustomerTransactionsService,
    CustomerTransactionsImportService,
    RtkStatementPdfService,
  ],
})
export class CustomerTransactionsModule {}
