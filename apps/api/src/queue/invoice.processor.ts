import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';

@Processor('invoice')
export class InvoiceProcessor extends WorkerHost {
    private readonly logger = new Logger(InvoiceProcessor.name);

    constructor(private readonly pdfService: InvoicePdfService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing invoice job: ${job.name} (ID: ${job.id})`);

        try {
            if (job.name === 'generate-pdf') {
                const { invoiceId } = job.data;
                this.logger.log(`Generating PDF for invoice: ${invoiceId}`);
                const url = await this.pdfService.generateInvoicePdf(invoiceId);
                return { success: true, url };
            }
        } catch (error) {
            this.logger.error(`Failed to process job ${job.name}`, (error as Error).stack);
            throw error;
        }
    }
}
