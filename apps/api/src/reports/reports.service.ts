import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import * as csv from 'fast-csv';
import { GstUtility } from '../common/utils/gst.util';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Generates a monthly GST Report for Chartered Accountants.
     * Uses streaming to avoid loading massive amounts of DB records into memory at once.
     */
    async streamCaGstExport(orgId: string, month: number, year: number, res: Response) {
        if (month < 1 || month > 12) {
            throw new BadRequestException('Month must be between 1 and 12');
        }

        // Determine strict IST boundaries for the month
        const timezone = 'Asia/Kolkata';
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        // Wait, the easiest way is to build the ISODate string in IST and turn to Date
        // Actually, UTC 18:30 is 00:00 IST. Let's do it manually:
        const startIst = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);

        // next month
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endIst = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);

        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true, gstNumber: true, state: true }
        });

        if (!org) throw new BadRequestException('Organization not found');

        const fileName = `${org.name.replace(/[^a-z0-9]/gi, '_')}_GST_Export_${String(month).padStart(2, '0')}_${year}.csv`;
        res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'text/csv');

        const csvStream = csv.format({ headers: true });
        csvStream.pipe(res);

        let skip = 0;
        const take = 500;
        let hasMore = true;

        try {
            while (hasMore) {
                // Fetch Orders in batches
                const orders = await this.prisma.order.findMany({
                    where: {
                        orgId,
                        createdAt: {
                            gte: startIst,
                            lt: endIst,
                        },
                        status: { notIn: ['DRAFT', 'CANCELLED'] } // typically we only report actual fulfilled/confirmed sales
                    },
                    include: {
                        customer: { select: { name: true, gstNumber: true, state: true } },
                        invoice: { select: { invoiceNumber: true } },
                        items: {
                            include: {
                                product: { select: { hsnCode: true, cessRate: true, gstRate: true } }
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' },
                    skip,
                    take,
                });

                if (orders.length === 0) {
                    hasMore = false;
                    break;
                }

                // Process each line item
                for (const order of orders) {
                    const invDate = order.createdAt.toLocaleDateString('en-IN', { timeZone: timezone });
                    const invNo = order.invoice?.invoiceNumber ?? order.orderNumber;

                    const sellerGst = org.gstNumber ?? org.state;
                    const buyerGst = order.customer.gstNumber ?? order.customer.state ?? sellerGst; // default intra if no data

                    for (const item of order.items) {
                        // we use the taxRate snapshot from order level for GST, and product cessRate for CESS
                        const gstRate = item.taxRate ?? item.product?.gstRate ?? 0;
                        const cessRate = item.product?.cessRate ?? 0;

                        const lineTaxable = item.price * item.quantity - (item.discount ?? 0);

                        const taxes = GstUtility.calculateTaxes(sellerGst, buyerGst, lineTaxable, gstRate, cessRate);

                        // Export exactly what the CA needs per line item
                        csvStream.write({
                            'Invoice Date': invDate,
                            'Invoice Number': invNo,
                            'Customer Name': order.customer.name,
                            'Customer GSTIN': order.customer.gstNumber ?? 'Unregistered',
                            'Place of Supply': order.customer.state ?? 'Unknown',
                            'HSN Code': item.product?.hsnCode ?? '',
                            'Quantity': item.quantity,
                            'Taxable Value': taxes.taxableValue.toFixed(2),
                            'CGST Amount': taxes.cgstAmount.toFixed(2),
                            'SGST Amount': taxes.sgstAmount.toFixed(2),
                            'IGST Amount': taxes.igstAmount.toFixed(2),
                            'Cess Amount': taxes.cessAmount.toFixed(2),
                            'Total Invoice Value': (taxes.taxableValue + taxes.totalTaxAmount).toFixed(2),
                        });
                    }
                }

                skip += take;
                if (orders.length < take) {
                    hasMore = false; // completed
                }
            }
        } catch (error) {
            this.logger.error('Error generating CA GST Export', error);
            // Can't really change status code if stream already started, but we end stream
        } finally {
            csvStream.end();
        }
    }
}
