import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvoiceForTally,
  PaymentForTally,
  CustomerForTally,
  StockItemForTally,
  buildSalesVouchersEnvelope,
  buildReceiptVouchersEnvelope,
  buildCombinedVouchersEnvelope,
  buildMastersEnvelope,
  buildSalesCSV,
  buildReceiptsCSV,
  formatDisplayDate,
} from './tally-xml';

export interface TallyExportQuery {
  startDate?: string;
  endDate?: string;
  onlyUnsynced?: string | boolean;
  limit?: string | number;
}

@Injectable()
export class TallyService {
  constructor(private prisma: PrismaService) {}

  async getSummary(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });

    const companyName = (settings as any)?.tallyCompanyName || org?.name || 'My Company';
    const tallySyncEnabled = (settings as any)?.tallySyncEnabled ?? false;

    // Invoices summary
    const [unsyncedInvoices, syncedInvoices, unsyncedPayments, syncedPayments, totalCustomers, totalProducts] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: { orgId, status: { not: 'DRAFT' }, tallySyncedAt: null },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.invoice.aggregate({
          where: { orgId, status: { not: 'DRAFT' }, tallySyncedAt: { not: null } },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: { orgId, status: 'COMPLETED', tallySyncedAt: null },
          _count: { id: true },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { orgId, status: 'COMPLETED', tallySyncedAt: { not: null } },
          _count: { id: true },
          _sum: { amount: true },
        }),
        this.prisma.customer.count({
          where: { orgId, isActive: true },
        }),
        this.prisma.product.count({
          where: { orgId, isActive: true },
        }),
      ]);

    return {
      companyName,
      tallySyncEnabled,
      invoices: {
        unsyncedCount: unsyncedInvoices._count.id,
        unsyncedTotal: unsyncedInvoices._sum.totalAmount || 0,
        syncedCount: syncedInvoices._count.id,
        syncedTotal: syncedInvoices._sum.totalAmount || 0,
      },
      payments: {
        unsyncedCount: unsyncedPayments._count.id,
        unsyncedTotal: unsyncedPayments._sum.amount || 0,
        syncedCount: syncedPayments._count.id,
        syncedTotal: syncedPayments._sum.amount || 0,
      },
      masters: {
        customerCount: totalCustomers,
        productCount: totalProducts,
      },
    };
  }

  async getPendingList(orgId: string) {
    const invoices = (await this.prisma.invoice.findMany({
      where: { orgId, status: { not: 'DRAFT' }, tallySyncedAt: null },
      include: {
        items: { include: { product: true, variant: true } },
        customer: true,
        organization: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
    })) as any[];

    const payments = (await this.prisma.payment.findMany({
      where: { orgId, status: 'COMPLETED', tallySyncedAt: null },
      include: { customer: true, organization: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })) as any[];

    return { invoices, payments };
  }

  async exportSalesXML(orgId: string, query: TallyExportQuery, res: Response) {
    const { companyName, invoices } = await this.fetchInvoicesForExport(orgId, query);
    const xml = buildSalesVouchersEnvelope(companyName, invoices);

    const filename = `tally-sales-${formatDisplayDate(new Date())}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xml);
  }

  async exportReceiptsXML(orgId: string, query: TallyExportQuery, res: Response) {
    const { companyName, payments } = await this.fetchPaymentsForExport(orgId, query);
    const xml = buildReceiptVouchersEnvelope(companyName, payments);

    const filename = `tally-receipts-${formatDisplayDate(new Date())}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xml);
  }

  async exportCombinedXML(orgId: string, query: TallyExportQuery, res: Response) {
    const [{ companyName, invoices }, { payments }] = await Promise.all([
      this.fetchInvoicesForExport(orgId, query),
      this.fetchPaymentsForExport(orgId, query),
    ]);

    const xml = buildCombinedVouchersEnvelope(companyName, invoices, payments);
    const filename = `tally-all-vouchers-${formatDisplayDate(new Date())}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xml);
  }

  async exportMastersXML(orgId: string, res: Response) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });
    const companyName = (settings as any)?.tallyCompanyName || org?.name || 'My Company';

    const [customers, products] = await Promise.all([
      this.prisma.customer.findMany({
        where: { orgId, isActive: true },
        select: {
          id: true,
          name: true,
          gstNumber: true,
          phone: true,
          email: true,
          fullAddress: true,
          city: true,
          state: true,
          pincode: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { orgId, isActive: true },
        include: {
          variants: { where: { isActive: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const formattedCustomers: CustomerForTally[] = customers.map(c => ({
      id: c.id,
      name: c.name,
      gstin: c.gstNumber,
      phone: c.phone,
      email: c.email,
      address: c.fullAddress,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
    }));

    const stockItems: StockItemForTally[] = [];
    for (const p of products) {
      if (p.hasVariants && p.variants.length > 0) {
        for (const v of p.variants) {
          stockItems.push({
            id: v.id,
            name: `${p.name} - ${v.name}`,
            hsnCode: p.hsnCode,
            unit: p.unit || 'NOS',
            sellingPrice: Number(v.sellingPrice) || Number(p.sellingPrice) || 0,
            gstRate: p.gstRate,
          });
        }
      } else {
        stockItems.push({
          id: p.id,
          name: p.name,
          hsnCode: p.hsnCode,
          unit: p.unit || 'NOS',
          sellingPrice: Number(p.sellingPrice) || 0,
          gstRate: p.gstRate,
        });
      }
    }

    const xml = buildMastersEnvelope(companyName, formattedCustomers, stockItems);
    const filename = `tally-masters-${formatDisplayDate(new Date())}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xml);
  }

  async exportCSV(orgId: string, type: 'sales' | 'receipts', query: TallyExportQuery, res: Response) {
    if (type === 'sales') {
      const { invoices } = await this.fetchInvoicesForExport(orgId, query);
      const csv = buildSalesCSV(invoices);
      const filename = `sales-daybook-${formatDisplayDate(new Date())}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } else {
      const { payments } = await this.fetchPaymentsForExport(orgId, query);
      const csv = buildReceiptsCSV(payments);
      const filename = `receipts-daybook-${formatDisplayDate(new Date())}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }
  }

  async markSynced(orgId: string, body: { invoiceIds?: string[]; paymentIds?: string[] }) {
    const now = new Date();
    let updatedInvoices = 0;
    let updatedPayments = 0;

    if (body.invoiceIds && body.invoiceIds.length > 0) {
      const res = await this.prisma.invoice.updateMany({
        where: { orgId, id: { in: body.invoiceIds } },
        data: { tallySyncedAt: now },
      });
      updatedInvoices = res.count;
    }

    if (body.paymentIds && body.paymentIds.length > 0) {
      const res = await this.prisma.payment.updateMany({
        where: { orgId, id: { in: body.paymentIds } },
        data: { tallySyncedAt: now },
      });
      updatedPayments = res.count;
    }

    return { success: true, updatedInvoices, updatedPayments };
  }

  async resetSync(orgId: string, body: { invoiceIds?: string[]; paymentIds?: string[] }) {
    if (body.invoiceIds && body.invoiceIds.length > 0) {
      await this.prisma.invoice.updateMany({
        where: { orgId, id: { in: body.invoiceIds } },
        data: { tallySyncedAt: null },
      });
    }

    if (body.paymentIds && body.paymentIds.length > 0) {
      await this.prisma.payment.updateMany({
        where: { orgId, id: { in: body.paymentIds } },
        data: { tallySyncedAt: null },
      });
    }

    return { success: true };
  }

  async getConfig(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });
    return {
      companyName: (settings as any)?.tallyCompanyName || org?.name || '',
      tallySyncEnabled: (settings as any)?.tallySyncEnabled ?? false,
      tallyPort: 9000,
    };
  }

  async saveConfig(orgId: string, config: { companyName: string; tallySyncEnabled: boolean }) {
    await this.prisma.orgSettings.upsert({
      where: { orgId },
      update: {
        tallyCompanyName: config.companyName,
        tallySyncEnabled: config.tallySyncEnabled,
      } as any,
      create: {
        orgId,
        tallyCompanyName: config.companyName,
        tallySyncEnabled: config.tallySyncEnabled,
      } as any,
    });
    return { success: true };
  }

  // ─── Private Data Fetchers ────────────────────────────────────

  private async fetchInvoicesForExport(orgId: string, query: TallyExportQuery) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, gstNumber: true, state: true },
    });
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });
    const companyName = (settings as any)?.tallyCompanyName || org?.name || 'My Company';

    const where: any = {
      orgId,
      status: { not: 'DRAFT' },
    };

    if (query.onlyUnsynced === 'true' || query.onlyUnsynced === true) {
      where.tallySyncedAt = null;
    }

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      where.invoiceDate = { gte: start, lte: end };
    }

    const rawInvoices = await this.prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { invoiceDate: 'asc' },
      take: query.limit ? Number(query.limit) : 500,
    });

    const invoices: InvoiceForTally[] = rawInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      netAmount: inv.totalAmount,
      taxableAmount: inv.taxableAmount || (inv.totalAmount - (inv.cgstAmount + inv.sgstAmount + inv.igstAmount)),
      taxAmount: inv.cgstAmount + inv.sgstAmount + inv.igstAmount,
      totalAmount: inv.totalAmount,
      customer: {
        name: inv.customer.name,
        gstin: inv.customer.gstNumber,
        state: inv.customer.state,
        city: inv.customer.city,
        pincode: inv.customer.pincode,
        address: inv.customer.fullAddress,
      },
      org: {
        name: companyName,
        gstin: org?.gstNumber,
        state: org?.state,
      },
      items: inv.items.map((it) => ({
        product: {
          name: it.product.name,
          hsnCode: it.hsnCode || it.product.hsnCode,
          unit: it.unit || it.product.unit,
        },
        variantName: it.variant?.name,
        quantity: it.quantity,
        unit: it.unit,
        price: it.price,
        taxableAmt: it.taxableAmt,
        totalAmount: it.totalAmount,
        cgstAmount: it.cgstAmount,
        sgstAmount: it.sgstAmount,
        igstAmount: it.igstAmount,
        gstRate: it.gstRate,
      })),
    }));

    return { companyName, invoices };
  }

  private async fetchPaymentsForExport(orgId: string, query: TallyExportQuery) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });
    const companyName = (settings as any)?.tallyCompanyName || org?.name || 'My Company';

    const where: any = {
      orgId,
      status: 'COMPLETED',
    };

    if (query.onlyUnsynced === 'true' || query.onlyUnsynced === true) {
      where.tallySyncedAt = null;
    }

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const rawPayments = await this.prisma.payment.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit ? Number(query.limit) : 500,
    });

    const payments: PaymentForTally[] = rawPayments.map((p) => ({
      id: p.id,
      paymentNumber: p.tallyReceiptNumber || (p.referenceNumber ? `RCP-${p.referenceNumber}` : `RCP-${p.id.slice(-6)}`),
      paymentDate: p.paidAt || p.createdAt,
      amount: p.amount,
      paymentMethod: p.method,
      referenceNumber: p.referenceNumber,
      customer: {
        name: p.customer.name,
        gstin: p.customer.gstNumber,
      },
      org: {
        name: companyName,
      },
    }));

    return { companyName, payments };
  }
}
