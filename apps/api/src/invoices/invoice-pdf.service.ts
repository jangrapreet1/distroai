import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import * as QRCode from 'qrcode';
import InvoicePDF from './invoice.document';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) { }

  async generateInvoicePdf(invoiceId: string): Promise<string> {
    // 1. Fetch invoice with all relations
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: { include: { product: true } },
        customer: true,
        organization: { include: { settings: true } },
      },
    }) as any;

    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

    if (invoice.eInvoiceQrCode) {
      try {
        invoice.qrCodeDataUri = await QRCode.toDataURL(invoice.eInvoiceQrCode, { margin: 1 });
      } catch (err) {
        this.logger.error('Failed to generate QR code for PDF', err);
      }
    }

    // 2. Build PDF content using @react-pdf/renderer
    const pdfBuffer = await renderToBuffer(React.createElement(InvoicePDF as any, { invoice }) as any);

    const key = `invoices/${invoice.orgId}/${invoiceId}.pdf`;

    // 3. Upload to S3
    const url = await this.s3.upload(key, pdfBuffer, 'application/pdf');

    // 4. Update Invoice.pdfUrl
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: url },
    });

    // 5. Get signed URL for download
    const signedUrl = await this.s3.getSignedDownloadUrl(key, 604800); // 7 days
    this.logger.log(`Invoice PDF generated for ${invoice.invoiceNumber}: ${key}`);
    return signedUrl;
  }
}
