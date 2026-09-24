import { Module } from '@nestjs/common';
import { CustomerTransactionsController } from './customer-transactions.controller';
import { CustomerTransactionsService } from './customer-transactions.service';
import { RtkStatementPdfService } from './rtk-statement-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
  ],
  controllers: [CustomerTransactionsController],
  providers: [CustomerTransactionsService, RtkStatementPdfService],
  exports: [CustomerTransactionsService, RtkStatementPdfService],
})
export class CustomerTransactionsModule {}
