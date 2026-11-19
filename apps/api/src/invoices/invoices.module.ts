import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { EInvoiceService } from './einvoice.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
    imports: [PaymentsModule],
    controllers: [InvoicesController],
    providers: [InvoicesService, EInvoiceService, InvoicePdfService],
    exports: [InvoicesService, EInvoiceService, InvoicePdfService]
})
export class InvoicesModule { }
