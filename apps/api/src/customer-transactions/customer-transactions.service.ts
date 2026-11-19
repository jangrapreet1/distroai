import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@distroai/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { RedisService } from '../common/services/redis.service';
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
    @Optional() private readonly redis?: RedisService,
  ) {}

  async findOneCustomer(orgId: string, customerId: string) {
    return this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: { id: true, name: true, phone: true, outstandingAmount: true },
    });
  }

  private async generateInvoiceNumber(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
    const settings = await (tx as any).orgSettings?.findUnique?.({ where: { orgId } });
    const prefix = settings?.invoicePrefix ?? 'INV';
    const year = new Date().getFullYear();
    const count = (tx as any).invoice?.count ? await (tx as any).invoice.count({ where: { orgId } }) : 0;
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
    const settings = await (tx as any).orgSettings?.findUnique?.({ where: { orgId } });
    const prefix = settings?.orderPrefix || 'ORD';
    const count = (tx as any).order?.count ? await (tx as any).order.count({ where: { orgId } }) : 0;
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

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

      let record: any;

      if (dto.type === CustomerTransactionType.SALE) {
        // ── Unified Quick Sale: Deduct inventory, generate Invoice & Order, update Ledger ──
        let generatedInvoiceNumber: string | null = null;
        let invoiceRef = dto.reference || null;

        if ((tx as any).warehouse && (tx as any).invoice && (tx as any).order) {
          let warehouseId = dto.warehouseId;
          if (!warehouseId) {
            const defaultWh =
              (await (tx as any).warehouse.findFirst({
                where: { orgId, isDefault: true },
                select: { id: true },
              })) ||
              (await (tx as any).warehouse.findFirst({
                where: { orgId },
                select: { id: true },
              }));
            if (!defaultWh) {
              throw new BadRequestException('No warehouse found for organization');
            }
            warehouseId = defaultWh.id;
          }

          const invTxToCreate: Array<{
            inventoryId: string;
            quantity: number;
          }> = [];

          // Check stock availability and deduct inventory
          if (dto.items && dto.items.length > 0) {
            for (const it of dto.items) {
              if (it.productId) {
                const qtyDeduct = Math.max(1, Math.round(Number(it.quantity)));
                if (it.variantId && (tx as any).variantInventory) {
                  const locked = await tx.$queryRaw<
                    Array<{ id: string; quantity: number; reservedQty: number }>
                  >`
                    SELECT "id", "quantity", "reservedQty" FROM "VariantInventory"
                    WHERE "variantId" = ${it.variantId} AND "warehouseId" = ${warehouseId}
                    FOR UPDATE
                  `;
                  const varInv = locked[0];
                  const available = (varInv?.quantity ?? 0) - (varInv?.reservedQty ?? 0);
                  if (available < qtyDeduct) {
                    throw new BadRequestException(
                      `Insufficient stock for ${it.productName}. Only ${Math.max(0, available)} available in selected warehouse.`,
                    );
                  }
                  await (tx as any).variantInventory.update({
                    where: { id: varInv.id },
                    data: { quantity: { decrement: qtyDeduct } },
                  });

                  let inv = await (tx as any).inventory.findFirst({
                    where: { productId: it.productId, warehouseId },
                    select: { id: true },
                  });
                  if (!inv) {
                    inv = await (tx as any).inventory.create({
                      data: {
                        orgId,
                        productId: it.productId,
                        warehouseId,
                        quantity: 0,
                        reservedQty: 0,
                      },
                      select: { id: true },
                    });
                  }
                  invTxToCreate.push({ inventoryId: inv.id, quantity: -qtyDeduct });
                } else if ((tx as any).inventory) {
                  const locked = await tx.$queryRaw<
                    Array<{ id: string; quantity: number; reservedQty: number }>
                  >`
                    SELECT "id", "quantity", "reservedQty" FROM "Inventory"
                    WHERE "productId" = ${it.productId} AND "warehouseId" = ${warehouseId}
                    FOR UPDATE
                  `;
                  const inv = locked[0];
                  const available = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
                  if (available < qtyDeduct) {
                    throw new BadRequestException(
                      `Insufficient stock for ${it.productName}. Only ${Math.max(0, available)} available in selected warehouse.`,
                    );
                  }
                  await (tx as any).inventory.update({
                    where: { id: inv.id },
                    data: { quantity: { decrement: qtyDeduct } },
                  });
                  invTxToCreate.push({ inventoryId: inv.id, quantity: -qtyDeduct });
                }
              }
            }
          }

          generatedInvoiceNumber = await this.generateInvoiceNumber(tx, orgId);
          const generatedOrderNumber = await this.generateOrderNumber(tx, orgId);
          invoiceRef = dto.reference || generatedInvoiceNumber;

          // Ensure ad-hoc fallback product if line items have no catalog productId
          let fallbackProduct: { id: string } | null = null;
          const hasAdHocItems = (dto.items || []).some((it) => !it.productId);
          if (((hasAdHocItems || !dto.items || dto.items.length === 0)) && (tx as any).product) {
            fallbackProduct = await (tx as any).product.upsert({
              where: { orgId_sku: { orgId, sku: 'MISC-ADHOC' } },
              create: {
                orgId,
                name: 'General Items / Khata Goods',
                sku: 'MISC-ADHOC',
                unit: 'pcs',
                sellingPrice: 0,
                purchasePrice: 0,
                isActive: true,
              },
              update: {},
              select: { id: true },
            });
          }

          const invoice = await (tx as any).invoice.create({
            data: {
              orgId,
              invoiceNumber: generatedInvoiceNumber,
              customerId,
              invoiceDate: new Date(dto.date),
              dueDate: new Date(new Date(dto.date).getTime() + 30 * 24 * 60 * 60 * 1000),
              status: 'SENT',
              subtotal: round2(dto.amount),
              taxableAmount: round2(dto.amount),
              totalAmount: round2(dto.amount),
              balanceAmount: round2(dto.amount),
              paidAmount: 0,
              notes: dto.notes || dto.description || 'Quick Sale from Khata',
              items:
                dto.items && dto.items.length > 0
                  ? {
                      create: dto.items.map((i) => {
                        const pId = i.productId || fallbackProduct?.id || '';
                        const qty = Math.max(1, Math.round(Number(i.quantity)));
                        const unitPrice = round2(Number(i.unitPrice));
                        const lineAmt = round2(Number(i.amount ?? qty * unitPrice));
                        return {
                          productId: pId,
                          variantId: i.variantId || null,
                          description: i.productName,
                          quantity: qty,
                          unit: i.unit || 'pcs',
                          price: unitPrice,
                          taxableAmt: lineAmt,
                          gstRate: 0,
                          totalAmount: lineAmt,
                        };
                      }),
                    }
                  : undefined,
            },
          });

          const order = await (tx as any).order.create({
            data: {
              orgId,
              orderNumber: generatedOrderNumber,
              customerId,
              warehouseId,
              status: 'DELIVERED',
              type: 'SALE',
              source: 'APP',
              totalAmount: round2(dto.amount),
              netAmount: round2(dto.amount),
              balanceAmount: round2(dto.amount),
              paidAmount: 0,
              invoiceId: invoice.id,
              notes: dto.notes || dto.description || 'Quick Sale from Khata',
              items:
                dto.items && dto.items.length > 0
                  ? {
                      create: dto.items.map((i) => {
                        const pId = i.productId || fallbackProduct?.id || '';
                        const qty = Math.max(1, Math.round(Number(i.quantity)));
                        const unitPrice = round2(Number(i.unitPrice));
                        const lineAmt = round2(Number(i.amount ?? qty * unitPrice));
                        return {
                          productId: pId,
                          variantId: i.variantId || null,
                          quantity: qty,
                          orderedQty: qty,
                          deliveredQty: qty,
                          pendingQty: 0,
                          unit: i.unit || 'pcs',
                          price: unitPrice,
                          totalAmount: lineAmt,
                        };
                      }),
                    }
                  : undefined,
              statusHistory: {
                create: {
                  toStatus: 'DELIVERED',
                  note: 'Quick Sale created directly from Customer Khata',
                  changedBy: userId,
                },
              },
            },
          });

          // Record Inventory Transactions referencing the order
          if ((tx as any).inventoryTransaction) {
            for (const rec of invTxToCreate) {
              await (tx as any).inventoryTransaction.create({
                data: {
                  inventoryId: rec.inventoryId,
                  type: 'OUT',
                  quantity: rec.quantity,
                  referenceType: 'ORDER',
                  referenceId: order.id,
                  note: `Quick Sale ${order.orderNumber} to customer`,
                  createdBy: userId,
                },
              });
            }
          }

          if ((tx as any).ledgerEntry) {
            await (tx as any).ledgerEntry.create({
              data: {
                orgId,
                customerId,
                type: 'DEBIT',
                amount: round2(dto.amount),
                balance: 0,
                referenceId: invoice.id,
                referenceType: 'INVOICE',
                notes: dto.description || `Invoice ${generatedInvoiceNumber} (Quick Sale)`,
              },
            });
          }
        }

        record = await tx.customerTransaction.create({
          data: {
            orgId,
            customerId,
            date: new Date(dto.date),
            type: dto.type,
            description: dto.description || null,
            amount: new Prisma.Decimal(round2(dto.amount)),
            paymentMethod: dto.paymentMethod || null,
            reference: invoiceRef,
            notes: dto.notes || null,
            items:
              dto.items && dto.items.length > 0
                ? {
                    create: dto.items.map((i) => ({
                      productId: i.productId || null,
                      productName: i.productName,
                      quantity: new Prisma.Decimal(i.quantity),
                      unitPrice: new Prisma.Decimal(round2(i.unitPrice)),
                      amount: new Prisma.Decimal(round2(i.amount ?? i.quantity * i.unitPrice)),
                      unit: i.unit || null,
                    })),
                  }
                : undefined,
          },
          include: {
            items: true,
          },
        });
      } else if (dto.type === CustomerTransactionType.PAYMENT) {
        // ── Payment Received: Create Payment record, auto-apply to invoices, update Ledger ──
        let payment: any = null;
        if ((tx as any).payment) {
          payment = await (tx as any).payment.create({
            data: {
              orgId,
              customerId,
              amount: round2(dto.amount),
              method: (dto.paymentMethod as any) || 'CASH',
              referenceNumber: dto.reference || null,
              status: 'COMPLETED',
              paidAt: new Date(dto.date),
              notes: dto.notes || dto.description || 'Payment received via Customer Khata',
            },
          });

          // Auto-apply payment to outstanding unpaid invoices if any
          if ((tx as any).invoice && (tx as any).paymentAllocation) {
            let unallocated = round2(dto.amount);
            const unpaidInvoices = await (tx as any).invoice.findMany({
              where: { orgId, customerId, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
              orderBy: { invoiceDate: 'asc' },
            });

            for (const inv of unpaidInvoices) {
              if (unallocated <= 0) break;
              const invoiceBal = Number(inv.balanceAmount);
              const toApply = round2(Math.min(unallocated, invoiceBal));
              if (toApply <= 0) continue;

              await (tx as any).paymentAllocation.create({
                data: {
                  paymentId: payment.id,
                  invoiceId: inv.id,
                  amountAllocated: toApply,
                },
              });

              const newBal = round2(invoiceBal - toApply);
              const newPaid = round2(Number(inv.paidAmount) + toApply);
              await (tx as any).invoice.update({
                where: { id: inv.id },
                data: {
                  paidAmount: newPaid,
                  balanceAmount: newBal,
                  status: newBal <= 0 ? 'PAID' : 'PARTIAL',
                },
              });

              unallocated = round2(unallocated - toApply);
            }

            if (unallocated > 0) {
              await (tx as any).payment.update({
                where: { id: payment.id },
                data: { advanceAmount: unallocated },
              });
            }
          }

          if ((tx as any).ledgerEntry) {
            await (tx as any).ledgerEntry.create({
              data: {
                orgId,
                customerId,
                type: 'CREDIT',
                amount: round2(dto.amount),
                balance: 0,
                referenceId: payment.id,
                referenceType: 'PAYMENT',
                notes: dto.description || `Payment received (${dto.paymentMethod || 'CASH'})`,
              },
            });
          }
        }

        record = await tx.customerTransaction.create({
          data: {
            orgId,
            customerId,
            date: new Date(dto.date),
            type: dto.type,
            description: dto.description || null,
            amount: new Prisma.Decimal(round2(dto.amount)),
            paymentMethod: dto.paymentMethod || null,
            reference: dto.reference || null,
            notes: payment?.id
              ? (dto.notes ? `${dto.notes} (Payment ID: ${payment.id})` : `Payment ID: ${payment.id}`)
              : (dto.notes || null),
          },
          include: { items: true },
        });
      } else if (dto.type === CustomerTransactionType.RETURN) {
        // ── Goods Return: Restock inventory if items provided, update Ledger ──
        if (dto.items && dto.items.length > 0 && (tx as any).warehouse) {
          let warehouseId = dto.warehouseId;
          if (!warehouseId) {
            const wh =
              (await (tx as any).warehouse.findFirst({
                where: { orgId, isDefault: true },
                select: { id: true },
              })) ||
              (await (tx as any).warehouse.findFirst({
                where: { orgId },
                select: { id: true },
              }));
            warehouseId = wh?.id;
          }

          if (warehouseId) {
            for (const it of dto.items) {
              if (it.productId) {
                const qtyIncrement = Math.max(1, Math.round(Number(it.quantity)));
                if (it.variantId && (tx as any).variantInventory) {
                  await (tx as any).variantInventory.updateMany({
                    where: { variantId: it.variantId, warehouseId },
                    data: { quantity: { increment: qtyIncrement } },
                  });
                  if ((tx as any).inventory && (tx as any).inventoryTransaction) {
                    const inv = await (tx as any).inventory.findFirst({
                      where: { productId: it.productId, warehouseId },
                      select: { id: true },
                    });
                    if (inv) {
                      await (tx as any).inventoryTransaction.create({
                        data: {
                          inventoryId: inv.id,
                          type: 'RETURN',
                          quantity: qtyIncrement,
                          referenceType: 'RETURN',
                          note: `Goods return from customer`,
                          createdBy: userId,
                        },
                      });
                    }
                  }
                } else if ((tx as any).inventory) {
                  await (tx as any).inventory.updateMany({
                    where: { productId: it.productId, warehouseId },
                    data: { quantity: { increment: qtyIncrement } },
                  });
                  if ((tx as any).inventoryTransaction) {
                    const inv = await (tx as any).inventory.findFirst({
                      where: { productId: it.productId, warehouseId },
                      select: { id: true },
                    });
                    if (inv) {
                      await (tx as any).inventoryTransaction.create({
                        data: {
                          inventoryId: inv.id,
                          type: 'RETURN',
                          quantity: qtyIncrement,
                          referenceType: 'RETURN',
                          note: `Goods return from customer`,
                          createdBy: userId,
                        },
                      });
                    }
                  }
                }
              }
            }
          }
        }

        if ((tx as any).ledgerEntry) {
          await (tx as any).ledgerEntry.create({
            data: {
              orgId,
              customerId,
              type: 'CREDIT',
              amount: round2(dto.amount),
              balance: 0,
              referenceType: 'RETURN',
              notes: dto.description || 'Goods returned by customer',
            },
          });
        }

        record = await tx.customerTransaction.create({
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
            items:
              dto.items && dto.items.length > 0
                ? {
                    create: dto.items.map((i) => ({
                      productId: i.productId || null,
                      productName: i.productName,
                      quantity: new Prisma.Decimal(i.quantity),
                      unitPrice: new Prisma.Decimal(round2(i.unitPrice)),
                      amount: new Prisma.Decimal(round2(i.amount ?? i.quantity * i.unitPrice)),
                      unit: i.unit || null,
                    })),
                  }
                : undefined,
          },
          include: { items: true },
        });
      } else {
        // ── Manual Balance Adjustment ──
        if ((tx as any).ledgerEntry) {
          await (tx as any).ledgerEntry.create({
            data: {
              orgId,
              customerId,
              type: dto.amount >= 0 ? 'DEBIT' : 'CREDIT',
              amount: Math.abs(round2(dto.amount)),
              balance: 0,
              referenceType: 'MANUAL_ADJUSTMENT',
              notes: dto.description || 'Manual balance adjustment',
            },
          });
        }

        record = await tx.customerTransaction.create({
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
          },
          include: { items: true },
        });
      }

      // Authoritatively recalculate customer balance from transactions
      const allTx = await tx.customerTransaction.findMany({
        where: { orgId, customerId },
        select: { type: true, amount: true },
      });
      const summary = CustomerLedgerCalculationEngine.computeSummary(allTx);

      await tx.customer.update({
        where: { id: customerId },
        data: { outstandingAmount: summary.netBalance },
      });

      // Update the latest ledgerEntry balance
      if ((tx as any).ledgerEntry) {
        const latestLedgerEntry = await (tx as any).ledgerEntry.findFirst({
          where: { orgId, customerId },
          orderBy: { createdAt: 'desc' },
        });
        if (latestLedgerEntry) {
          await (tx as any).ledgerEntry.update({
            where: { id: latestLedgerEntry.id },
            data: { balance: summary.netBalance },
          });
        }
      }

      return record;
    });

    // Invalidate Redis analytics cache
    if (this.redis) {
      await Promise.allSettled([
        this.redis.del(`analytics:dashboard:${orgId}`),
        this.redis.del(`analytics:sales:${orgId}`),
      ]);
    }

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
        updatedAt: t.updatedAt,
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

  /**
   * Return human-readable audit change history for customer ledger or a specific transaction.
   * Multi-tenant scoped by orgId.
   */
  async getLedgerAuditLogs(
    orgId: string,
    customerId: string,
    query: { transactionId?: string; page?: number; limit?: number } = {},
  ): Promise<{ logs: any[]; total: number }> {
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

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const offset = (page - 1) * limit;

    let rawLogs: any[] = [];
    let total = 0;

    if (query.transactionId) {
      // Scoped to single transaction
      const where = {
        orgId,
        entityType: 'CUSTOMER_TRANSACTION',
        entityId: query.transactionId,
      };
      const [data, count] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        this.prisma.auditLog.count({ where }),
      ]);
      rawLogs = data;
      total = count;
    } else {
      // Customer-wide ledger history
      const txRows = await this.prisma.customerTransaction.findMany({
        where: { orgId, customerId },
        select: { id: true },
      });
      const txIds = txRows.map((t) => t.id);

      const logs = await this.prisma.$queryRaw<any[]>`
        SELECT 
          al."id",
          al."orgId",
          al."userId",
          al."action",
          al."entityType",
          al."entityId",
          al."oldValue",
          al."newValue",
          al."createdAt",
          u."firstName",
          u."lastName",
          u."email"
        FROM "AuditLog" al
        LEFT JOIN "User" u ON al."userId" = u."id"
        WHERE al."orgId" = ${orgId}
          AND (
            al."entityId" = ${customerId}
            ${txIds.length > 0 ? Prisma.sql`OR al."entityId" IN (${Prisma.join(txIds)})` : Prisma.empty}
            OR (
              al."entityType" = 'CUSTOMER_TRANSACTION'
              AND (
                CAST(al."oldValue" AS text) LIKE ${'%"customerId":"' + customerId + '"%'}
                OR CAST(al."newValue" AS text) LIKE ${'%"customerId":"' + customerId + '"%'}
              )
            )
          )
        ORDER BY al."createdAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "AuditLog" al
        WHERE al."orgId" = ${orgId}
          AND (
            al."entityId" = ${customerId}
            ${txIds.length > 0 ? Prisma.sql`OR al."entityId" IN (${Prisma.join(txIds)})` : Prisma.empty}
            OR (
              al."entityType" = 'CUSTOMER_TRANSACTION'
              AND (
                CAST(al."oldValue" AS text) LIKE ${'%"customerId":"' + customerId + '"%'}
                OR CAST(al."newValue" AS text) LIKE ${'%"customerId":"' + customerId + '"%'}
              )
            )
          )
      `;

      rawLogs = logs.map((l) => ({
        ...l,
        user: l.userId
          ? {
              id: l.userId,
              firstName: l.firstName,
              lastName: l.lastName,
              email: l.email,
            }
          : null,
      }));
      total = Number(countResult[0]?.count ?? 0);
    }

    const formatted = rawLogs.map((log) => this.formatLedgerAuditRecord(log));

    return {
      logs: formatted,
      total,
    };
  }

  private parseAuditSnapshot(val: unknown): any {
    if (!val) return null;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    return val;
  }

  private formatLedgerAuditRecord(log: any) {
    const oldVal = this.parseAuditSnapshot(log.oldValue);
    const newVal = this.parseAuditSnapshot(log.newValue);

    const userName = log.user
      ? [log.user.firstName, log.user.lastName].filter(Boolean).join(' ') || log.user.email || 'Staff'
      : 'System / Biller';

    const action = log.action as string;
    const entityType = log.entityType as string;
    const changes: Array<{
      field: string;
      label: string;
      oldValue: any;
      newValue: any;
      description: string;
    }> = [];

    let summary = '';
    let snapshot: any = null;

    if (entityType === 'CUSTOMER_KHATA_IMPORT' || action === 'IMPORT') {
      const count = newVal?.importedTransactionsCount ?? newVal?.importedCount ?? 0;
      summary = `Imported ${count} transactions from document`;
      snapshot = {
        type: 'IMPORT',
        amount: newVal?.newOutstandingAmount,
        description: `Imported ${count} entries`,
      };
    } else if (action === 'CREATE') {
      const type = newVal?.type || 'Transaction';
      const amt = newVal?.amount != null ? `₹${Number(newVal.amount).toLocaleString('en-IN')}` : '';
      const desc = newVal?.description ? ` (${newVal.description})` : '';
      summary = `Added ${type} of ${amt}${desc}`;
      snapshot = {
        date: newVal?.date,
        type: newVal?.type,
        amount: newVal?.amount != null ? Number(newVal.amount) : undefined,
        description: newVal?.description,
      };
    } else if (action === 'DELETE') {
      const type = oldVal?.type || 'Transaction';
      const amt = oldVal?.amount != null ? `₹${Number(oldVal.amount).toLocaleString('en-IN')}` : '';
      const desc = oldVal?.description ? ` (${oldVal.description})` : '';
      summary = `Deleted ${type} of ${amt}${desc}`;
      snapshot = {
        date: oldVal?.date,
        type: oldVal?.type,
        amount: oldVal?.amount != null ? Number(oldVal.amount) : undefined,
        description: oldVal?.description,
      };
    } else if (action === 'UPDATE') {
      snapshot = {
        date: newVal?.date || oldVal?.date,
        type: newVal?.type || oldVal?.type,
        amount: newVal?.amount != null ? Number(newVal.amount) : oldVal?.amount != null ? Number(oldVal.amount) : undefined,
        description: newVal?.description || oldVal?.description,
      };

      if (oldVal?.amount != null && newVal?.amount != null && Number(oldVal.amount) !== Number(newVal.amount)) {
        changes.push({
          field: 'amount',
          label: 'Amount',
          oldValue: Number(oldVal.amount),
          newValue: Number(newVal.amount),
          description: `Amount changed from ₹${Number(oldVal.amount).toLocaleString('en-IN')} to ₹${Number(newVal.amount).toLocaleString('en-IN')}`,
        });
      }

      if (oldVal?.date && newVal?.date && oldVal.date !== newVal.date) {
        changes.push({
          field: 'date',
          label: 'Date',
          oldValue: oldVal.date,
          newValue: newVal.date,
          description: `Date moved from ${oldVal.date} to ${newVal.date}`,
        });
      }

      if (oldVal?.type && newVal?.type && oldVal.type !== newVal.type) {
        changes.push({
          field: 'type',
          label: 'Type',
          oldValue: oldVal.type,
          newValue: newVal.type,
          description: `Type changed from ${oldVal.type} to ${newVal.type}`,
        });
      }

      if (oldVal?.description !== newVal?.description && (oldVal?.description || newVal?.description)) {
        changes.push({
          field: 'description',
          label: 'Particulars',
          oldValue: oldVal?.description || '—',
          newValue: newVal?.description || '—',
          description: `Particulars updated to "${newVal?.description || 'None'}"`,
        });
      }

      if (oldVal?.paymentMethod !== newVal?.paymentMethod && (oldVal?.paymentMethod || newVal?.paymentMethod)) {
        changes.push({
          field: 'paymentMethod',
          label: 'Payment Method',
          oldValue: oldVal?.paymentMethod || '—',
          newValue: newVal?.paymentMethod || '—',
          description: `Payment method changed to ${newVal?.paymentMethod || 'None'}`,
        });
      }

      if (oldVal?.reference !== newVal?.reference && (oldVal?.reference || newVal?.reference)) {
        changes.push({
          field: 'reference',
          label: 'Reference',
          oldValue: oldVal?.reference || '—',
          newValue: newVal?.reference || '—',
          description: `Reference changed to "${newVal?.reference || 'None'}"`,
        });
      }

      const oldItemCount = Array.isArray(oldVal?.items) ? oldVal.items.length : 0;
      const newItemCount = Array.isArray(newVal?.items) ? newVal.items.length : 0;
      if (oldItemCount !== newItemCount) {
        changes.push({
          field: 'items',
          label: 'Items',
          oldValue: `${oldItemCount} items`,
          newValue: `${newItemCount} items`,
          description: `Item count changed from ${oldItemCount} to ${newItemCount}`,
        });
      }

      if (changes.length > 0) {
        summary = changes.map((c) => c.description).join(', ');
      } else {
        summary = 'Transaction details updated';
      }
    } else {
      summary = `${action} on ${entityType}`;
    }

    return {
      id: log.id,
      action,
      entityType,
      entityId: log.entityId,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
      user: {
        id: log.userId,
        name: userName,
        email: log.user?.email,
      },
      summary,
      changes,
      transactionSnapshot: snapshot,
    };
  }
}
