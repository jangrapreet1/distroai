import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@distroai/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { RtkStatementPdfService } from './rtk-statement-pdf.service';
import {
  CustomerTransactionType,
  PaymentMethod,
  calculateCustomerLedger,
  CustomerLedgerCalculationEngine,
  round2,
  toDateOnlyString,
  LedgerSummary,
} from './customer-transactions.calculation';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';

export interface RTKStatementData {
  organization: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    gstin?: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  };
  statementDate: string;
  rows: Array<{
    date: string;
    particulars: string;
    amount?: number | null;
    goodsGivenAmount?: number | null;
    returned?: number | null;
    returnedAmount?: number | null;
    paymentReceived?: number | null;
    paymentReceivedAmount?: number | null;
    runningBalance: number;
    rawType?: CustomerTransactionType;
  }>;
  summary: LedgerSummary;
}

@Injectable()
export class CustomerTransactionsService {
  private readonly logger = new Logger(CustomerTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly rtkPdfService: RtkStatementPdfService = new RtkStatementPdfService(),
  ) {}

  /**
   * Helper to format Prisma Decimals to clean 2-decimal JavaScript numbers.
   */
  private serializeItem(item: any) {
    return {
      id: item.id,
      productId: item.productId ?? null,
      productName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: round2(Number(item.unitPrice)),
      amount: round2(Number(item.amount)),
      unit: item.unit ?? null,
    };
  }

  private serializeTransaction(tx: any) {
    return {
      id: tx.id,
      orgId: tx.orgId,
      customerId: tx.customerId,
      date: toDateOnlyString(tx.date),
      type: tx.type,
      description: tx.description ?? '',
      amount: round2(Number(tx.amount)),
      paymentMethod: tx.paymentMethod ?? null,
      reference: tx.reference ?? null,
      notes: tx.notes ?? null,
      items: (tx.items || []).map((i: any) => this.serializeItem(i)),
      createdAt: tx.createdAt ? (tx.createdAt instanceof Date ? tx.createdAt.toISOString() : String(tx.createdAt)) : new Date().toISOString(),
      updatedAt: tx.updatedAt ? (tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : String(tx.updatedAt)) : new Date().toISOString(),
    };
  }

  /**
   * Safely logs mutation audit trail without throwing.
   */
  private async safeAuditLog(params: {
    orgId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue: unknown;
    newValue: unknown;
  }): Promise<void> {
    try {
      await this.auditLogService.log(params);
    } catch (auditErr) {
      this.logger.error(`Failed to log audit trail for ${params.entityId}`, auditErr);
    }
  }

  /**
   * Create a new Customer Transaction with items, update Customer.outstandingAmount atomically,
   * and record an audit log.
   */
  async create(
    orgId: string,
    customerId: string,
    userId: string,
    dto: CreateTransactionDto,
  ) {
    // 1. Validate Customer existence and tenant ownership
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: { id: true, name: true },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
      });
    }

    // 2. Validate Amount
    if (dto.amount === undefined || dto.amount === null || isNaN(dto.amount)) {
      throw new BadRequestException('Amount is required');
    }
    if (dto.amount < 0 && dto.type !== CustomerTransactionType.ADJUSTMENT) {
      throw new BadRequestException('Amount must be non-negative');
    }

    // 3. Validate Date format
    if (!dto.date || !/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    // 4. Validate Line Items
    if (dto.items && dto.items.length > 0) {
      for (const it of dto.items) {
        if (!it.productName || it.productName.trim() === '') {
          throw new BadRequestException('Line item productName is required');
        }
        if (it.quantity <= 0) {
          throw new BadRequestException('Line item quantity must be greater than zero');
        }
        if (it.unitPrice < 0) {
          throw new BadRequestException('Line item unitPrice cannot be negative');
        }
      }
    }

    // 5. Atomic transaction execution with row locking
    const createdTx = await this.prisma.$transaction(async (tx) => {
      // Row lock customer record
      await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${customerId} AND "orgId" = ${orgId} FOR UPDATE`;

      const record = await tx.customerTransaction.create({
        data: {
          orgId,
          customerId,
          date: new Date(dto.date),
          type: dto.type,
          description: dto.description || null,
          amount: new Prisma.Decimal(round2(dto.amount)),
          paymentMethod: dto.paymentMethod || null,
          reference: dto.reference || null,
          notes: dto.notes || null,
          items: dto.items && dto.items.length > 0 ? {
            create: dto.items.map((i) => ({
              productId: i.productId || null,
              productName: i.productName,
              quantity: new Prisma.Decimal(i.quantity),
              unitPrice: new Prisma.Decimal(round2(i.unitPrice)),
              amount: new Prisma.Decimal(round2(i.amount ?? i.quantity * i.unitPrice)),
              unit: i.unit || null,
            })),
          } : undefined,
        },
        include: {
          items: true,
        },
      });

      // Recalculate customer balance from authoritative transactions
      const allTx = await tx.customerTransaction.findMany({
        where: { orgId, customerId },
        select: { type: true, amount: true },
      });
      const summary = CustomerLedgerCalculationEngine.computeSummary(allTx);

      await tx.customer.update({
        where: { id: customerId },
        data: { outstandingAmount: summary.netBalance },
      });

      return record;
    });

    const serialized = this.serializeTransaction(createdTx);

    // 6. Record Audit Log (safe non-blocking error resilience)
    await this.safeAuditLog({
      orgId,
      userId,
      action: 'CREATE',
      entityType: 'CUSTOMER_TRANSACTION',
      entityId: serialized.id,
      oldValue: null,
      newValue: serialized,
    });

    return serialized;
  }

  /**
   * Return chronologically sorted ledger entries with running balance and summary aggregates.
   */
  async findAllLedger(
    orgId: string,
    customerId: string,
    query?: LedgerQueryDto,
  ) {
    // 1. Verify Customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: { id: true, name: true, phone: true, outstandingAmount: true },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
      });
    }

    // 2. Build where clause
    const where: Prisma.CustomerTransactionWhereInput = {
      orgId,
      customerId,
    };

    if (query?.type) {
      where.type = query.type;
    }

    const startDate = query?.startDate || query?.dateFrom;
    const endDate = query?.endDate || query?.dateTo;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    // 3. Compute opening balance prior to startDate if range query
    let effectiveOpeningBalance = query?.initialBalance ?? 0;
    if (startDate) {
      const priorTx = await this.prisma.customerTransaction.findMany({
        where: {
          orgId,
          customerId,
          date: { lt: new Date(startDate) },
        },
        select: { type: true, amount: true },
      });
      const priorSummary = CustomerLedgerCalculationEngine.computeSummary(
        priorTx,
        query?.initialBalance ?? 0,
      );
      effectiveOpeningBalance = priorSummary.netBalance;
    }

    // 4. Query current period transactions in strict chronological sequence
    const transactions = await this.prisma.customerTransaction.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    // 5. Dynamic Ledger Calculation Engine
    const ledgerResult = calculateCustomerLedger(
      transactions.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        paymentMethod: t.paymentMethod,
        reference: t.reference,
        notes: t.notes,
        createdAt: t.createdAt,
        items: t.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          amount: it.amount,
        })),
      })),
      {
        initialBalance: effectiveOpeningBalance,
        includeOpeningBalanceRow:
          query?.includeOpeningBalanceRow ?? (startDate ? true : false),
        openingBalanceDate: startDate,
      },
    );

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        outstandingAmount: customer.outstandingAmount,
      },
      summary: ledgerResult.summary,
      entries: ledgerResult.entries,
    };
  }

  /**
   * Fetch a single transaction by ID, strictly enforcing orgId and customerId scoping.
   */
  async findOne(orgId: string, customerId: string, id: string) {
    const tx = await this.prisma.customerTransaction.findFirst({
      where: { id, customerId, orgId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!tx) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: `Transaction ${id} not found`,
      });
    }

    return this.serializeTransaction(tx);
  }

  /**
   * Update transaction details or line items, recalculate customer balance, and log audit trail.
   */
  async update(
    orgId: string,
    customerId: string,
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
  ) {
    const existing = await this.prisma.customerTransaction.findFirst({
      where: { id, customerId, orgId },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: `Transaction ${id} not found`,
      });
    }

    const targetType = dto.type ?? existing.type;
    if (dto.amount !== undefined && dto.amount < 0 && targetType !== CustomerTransactionType.ADJUSTMENT) {
      throw new BadRequestException('Amount must be non-negative');
    }

    if (dto.date && !/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    const oldSnapshot = this.serializeTransaction(existing);

    const updatedTx = await this.prisma.$transaction(async (tx) => {
      // Row lock customer record
      await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${customerId} AND "orgId" = ${orgId} FOR UPDATE`;

      if (dto.items !== undefined) {
        await tx.customerTransactionItem.deleteMany({
          where: { transactionId: id },
        });
      }

      const record = await tx.customerTransaction.update({
        where: { id },
        data: {
          ...(dto.date && { date: new Date(dto.date) }),
          ...(dto.type && { type: dto.type }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.amount !== undefined && { amount: new Prisma.Decimal(round2(dto.amount)) }),
          ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
          ...(dto.reference !== undefined && { reference: dto.reference }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.items !== undefined && {
            items: {
              create: dto.items.map((i) => ({
                productId: i.productId || null,
                productName: i.productName,
                quantity: new Prisma.Decimal(i.quantity),
                unitPrice: new Prisma.Decimal(round2(i.unitPrice)),
                amount: new Prisma.Decimal(round2(i.amount ?? i.quantity * i.unitPrice)),
                unit: i.unit || null,
              })),
            },
          }),
        },
        include: { items: true },
      });

      // Recalculate customer balance
      const allTx = await tx.customerTransaction.findMany({
        where: { orgId, customerId },
        select: { type: true, amount: true },
      });
      const summary = CustomerLedgerCalculationEngine.computeSummary(allTx);

      await tx.customer.update({
        where: { id: customerId },
        data: { outstandingAmount: summary.netBalance },
      });

      return record;
    });

    const newSnapshot = this.serializeTransaction(updatedTx);

    // Audit log
    await this.safeAuditLog({
      orgId,
      userId,
      action: 'UPDATE',
      entityType: 'CUSTOMER_TRANSACTION',
      entityId: id,
      oldValue: oldSnapshot,
      newValue: newSnapshot,
    });

    return newSnapshot;
  }

  /**
   * Delete transaction, atomically recalculate customer balance, and log audit trail.
   */
  async remove(orgId: string, customerId: string, id: string, userId: string) {
    const existing = await this.prisma.customerTransaction.findFirst({
      where: { id, customerId, orgId },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: `Transaction ${id} not found`,
      });
    }

    const oldSnapshot = this.serializeTransaction(existing);

    const remainingNetBalance = await this.prisma.$transaction(async (tx) => {
      // Row lock customer record
      await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${customerId} AND "orgId" = ${orgId} FOR UPDATE`;

      await tx.customerTransaction.delete({
        where: { id },
      });

      // Recalculate customer balance
      const allTx = await tx.customerTransaction.findMany({
        where: { orgId, customerId },
        select: { type: true, amount: true },
      });
      const summary = CustomerLedgerCalculationEngine.computeSummary(allTx);

      await tx.customer.update({
        where: { id: customerId },
        data: { outstandingAmount: summary.netBalance },
      });

      return summary.netBalance;
    });

    // Audit log
    await this.safeAuditLog({
      orgId,
      userId,
      action: 'DELETE',
      entityType: 'CUSTOMER_TRANSACTION',
      entityId: id,
      oldValue: oldSnapshot,
      newValue: null,
    });

    return {
      success: true,
      deletedId: id,
      currentBalance: remainingNetBalance,
    };
  }

  /**
   * Generates structured data required for the 5-column RTK Statement PDF and web view.
   */
  async getStatementData(
    orgId: string,
    customerId: string,
    query?: LedgerQueryDto,
  ): Promise<RTKStatementData> {
    const [org, customer] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          name: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          gstNumber: true,
        },
      }),
      this.prisma.customer.findFirst({
        where: { id: customerId, orgId },
        select: {
          id: true,
          name: true,
          phone: true,
          city: true,
          fullAddress: true,
        },
      }),
    ]);

    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
      });
    }

    const ledger = await this.findAllLedger(orgId, customerId, {
      startDate: query?.startDate || query?.dateFrom,
      endDate: query?.endDate || query?.dateTo,
      includeOpeningBalanceRow: true,
    });

    // Transform to RTK 5-column rows with dual aliases for complete compatibility
    const rows = ledger.entries.map((entry) => {
      let particulars = entry.description || '';
      if (entry.items && entry.items.length > 0) {
        const itemDetail = entry.items
          .map((i) => `${i.productName} (${i.quantity} @ ₹${round2(i.unitPrice)})`)
          .join(', ');
        particulars = particulars ? `${particulars} — ${itemDetail}` : itemDetail;
      }

      let amount: number | undefined;
      let returned: number | undefined;
      let paymentReceived: number | undefined;

      switch (entry.type) {
        case CustomerTransactionType.SALE:
          amount = entry.amount;
          if (!particulars) particulars = `Goods Given to ${customer.name}`;
          break;
        case CustomerTransactionType.RETURN:
          returned = entry.amount;
          if (!particulars) particulars = `Goods Returned by ${customer.name}`;
          break;
        case CustomerTransactionType.PAYMENT:
          paymentReceived = entry.amount;
          const methodStr = entry.paymentMethod ? ` via ${entry.paymentMethod}` : '';
          const refStr = entry.reference ? ` (Ref: ${entry.reference})` : '';
          if (!particulars) particulars = `Payment Received${methodStr}${refStr}`;
          break;
        case CustomerTransactionType.ADJUSTMENT:
          if (entry.amount >= 0) {
            amount = entry.amount;
            if (!particulars) particulars = 'Adjustment (Debit)';
          } else {
            returned = Math.abs(entry.amount);
            if (!particulars) particulars = 'Adjustment (Credit)';
          }
          break;
      }

      return {
        date: entry.date,
        particulars,
        amount: amount ?? null,
        goodsGivenAmount: amount ?? null,
        returned: returned ?? null,
        returnedAmount: returned ?? null,
        paymentReceived: paymentReceived ?? null,
        paymentReceivedAmount: paymentReceived ?? null,
        runningBalance: entry.runningBalance,
        rawType: entry.type,
      };
    });

    return {
      organization: {
        name: org.name,
        address: org.address,
        city: org.city,
        state: org.state,
        phone: org.phone,
        gstin: org.gstNumber,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        city: customer.city,
        address: customer.fullAddress ?? null,
      },
      statementDate: query?.statementDate || new Date().toISOString().slice(0, 10),
      rows,
      summary: ledger.summary,
    };
  }

  /**
   * Generates binary PDF stream buffer for the RTK Statement.
   */
  async generateStatementPdf(
    orgId: string,
    customerId: string,
    query?: LedgerQueryDto,
  ): Promise<Buffer> {
    const statement = await this.getStatementData(orgId, customerId, query);
    return await this.rtkPdfService.generatePdf(statement as any);
  }
}
