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
        this.logger.error('Failed to generate e-Invoice QR code for PDF', err);
      }
    }

    // Generate Dynamic NPCI UPI QR Code
    const upiId = invoice.organization?.settings?.upiId;
    if (upiId) {
      try {
        const orgName = invoice.organization?.name || 'Distributor';
        const amount = Number(invoice.balanceAmount ?? invoice.totalAmount ?? 0);
        if (amount > 0) {
          const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(orgName)}&am=${amount.toFixed(2)}&tr=${encodeURIComponent(invoice.invoiceNumber)}&tn=Invoice+${encodeURIComponent(invoice.invoiceNumber)}&cu=INR`;
          invoice.upiQrDataUri = await QRCode.toDataURL(upiUri, { margin: 1, width: 140 });
        }
      } catch (err) {
        this.logger.error('Failed to generate UPI QR code for PDF', err);
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
