import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import * as QRCode from 'qrcode';
import InvoicePDF from './invoice.document';
import { ensureReactPdfCompat } from '../common/utils/react-pdf-compat';
import { InvoiceCustomOptions } from './dto/custom-invoice-options.dto';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) { }

  private async prepareInvoiceForPdf(invoiceId: string, options?: InvoiceCustomOptions) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: { include: { product: true } },
        customer: true,
        organization: { include: { settings: true } },
      },
    }) as any;

    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

    const effectiveOptions: InvoiceCustomOptions = {
      ...(typeof invoice.customOptions === 'object' && invoice.customOptions ? invoice.customOptions : {}),
      ...(options ?? {}),
    };

    if (invoice.eInvoiceQrCode && effectiveOptions.showGstNumber !== false) {
      try {
        invoice.qrCodeDataUri = await QRCode.toDataURL(invoice.eInvoiceQrCode, { margin: 1 });
      } catch (err) {
        this.logger.error('Failed to generate e-Invoice QR code for PDF', err);
      }
    }

    // Generate Dynamic NPCI UPI QR Code if enabled
    const upiId = invoice.organization?.settings?.upiId;
    if (upiId && effectiveOptions.showUpiQr !== false) {
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

    return { invoice, effectiveOptions };
  }

  async generateInvoicePdfBuffer(invoiceId: string, options?: InvoiceCustomOptions): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const { invoice, effectiveOptions } = await this.prepareInvoiceForPdf(invoiceId, options);

    ensureReactPdfCompat(React);
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF as any, { invoice, options: effectiveOptions }) as any
    );

    return { buffer: pdfBuffer, invoiceNumber: invoice.invoiceNumber };
  }

  async generateInvoicePdf(invoiceId: string, options?: InvoiceCustomOptions, saveAsDefault = false): Promise<string> {
    const { invoice, effectiveOptions } = await this.prepareInvoiceForPdf(invoiceId, options);

    // Save custom options to DB if requested
    if (saveAsDefault && options) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { customOptions: options as any },
      });
    }

    ensureReactPdfCompat(React);
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF as any, { invoice, options: effectiveOptions }) as any
    );

    const key = `invoices/${invoice.orgId}/${invoiceId}.pdf`;

    // Upload to S3 (or local fallback)
    const url = await this.s3.upload(key, pdfBuffer, 'application/pdf');

    // Update Invoice.pdfUrl
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: url },
    });

    // Get signed URL for download
    const signedUrl = await this.s3.getSignedDownloadUrl(key, 604800); // 7 days
    this.logger.log(`Invoice PDF generated for ${invoice.invoiceNumber}: ${key}`);
    return signedUrl;
  }
}
