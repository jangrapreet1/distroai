import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@distroai/db";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/services/redis.service";
import {
  CreateOrderDto,
  ReturnOrderDto,
  DispatchOrderDto,
  ListOrdersQueryDto,
  MarkPaidDto,
} from "./dto/orders.dto";
import { InvoicesService } from "../invoices/invoices.service";
import { EventsService } from "../events/events.service";
import { CustomerLedgerCalculationEngine } from "../customer-transactions/customer-transactions.calculation";
import { NotificationsService } from "../notifications/notifications.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { RazorpayService } from "../payments/razorpay.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly invoices: InvoicesService,
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
    private readonly wa: WhatsAppService,
    private readonly razorpay: RazorpayService,
  ) { }

  private async invalidateAnalytics(orgId: string) {
    await Promise.all([
      this.redis.del(`analytics:dashboard:${orgId}`),
      this.redis.del(`analytics:sales:${orgId}`),
    ]);
  }

  private async generateOrderNumber(orgId: string): Promise<string> {
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
    });
    const prefix = settings?.orderPrefix ?? "ORD";
    const count = await this.prisma.order.count({ where: { orgId } });
    return `${prefix}-${String(count + 1).padStart(5, "0")}`;
  }

  async findAll(orgId: string, query: ListOrdersQueryDto) {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      customerId,
      salesmanId,
      source,
      dateFrom,
      dateTo,
    } = query;
    const where = {
      orgId,
      ...(status && {
        status: status as
          | "DRAFT"
          | "CONFIRMED"
          | "PACKED"
          | "DISPATCHED"
          | "DELIVERED"
          | "CANCELLED"
          | "RETURNED",
      }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
        ],
      }),
      ...(customerId && { customerId }),
      ...(salesmanId && { salesmanId }),
      ...(source && {
        source: source as "APP" | "WHATSAPP" | "PHONE" | "WEB" | "PORTAL",
      }),
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
    } as any;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async create(orgId: string, dto: CreateOrderDto, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, orgId },
    });
    if (!customer)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Customer not found",
      });

    let warehouseId = dto.warehouseId;
    if (!warehouseId) {
      const defaultWarehouse = await this.prisma.warehouse.findFirst({
        where: { orgId, isDefault: true },
      });
      if (!defaultWarehouse) {
        const anyWarehouse = await this.prisma.warehouse.findFirst({
          where: { orgId },
        });
        if (!anyWarehouse)
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "No warehouse found. Please create a warehouse first.",
          });
        warehouseId = anyWarehouse.id;
      } else {
        warehouseId = defaultWarehouse.id;
      }
    } else {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, orgId },
      });
      if (!warehouse)
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Warehouse not found",
        });
    }

    // Calculate totals
    const r2 = (n: number) => Math.round(n * 100) / 100;
    let totalAmount = 0,
      discountAmount = 0,
      taxAmount = 0;
    const itemsWithTax = await Promise.all(
      dto.items.map(async (item: any) => {
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, orgId },
        });
        if (!product)
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: `Product ${item.productId} not found`,
          });
        if (product.isDraft) {
          throw new BadRequestException({
            code: "PRODUCT_IS_DRAFT",
            message: `Product "${product.name}" is currently in draft and cannot be ordered. Please publish it first.`,
          });
        }

        const isSelfServe = dto.source === "PORTAL" || dto.source === "WEB";

        let actualPrice = item.price;
        let actualDiscount = item.discount ?? 0;

        if (isSelfServe) {
          // ── Real-time Inventory Block ──
          let available = 0;
          let displayName = product.name;
          let baseSellingPrice = product.sellingPrice;

          if (item.variantId) {
            const variant = await this.prisma.productVariant.findFirst({
              where: { id: item.variantId, productId: product.id, orgId },
            });
            if (variant) {
              displayName = `${product.name} (${variant.name})`;
              if (variant.sellingPrice != null) {
                baseSellingPrice = variant.sellingPrice;
              }
            }
            const varInv = await this.prisma.variantInventory.findFirst({
              where: { variantId: item.variantId, warehouseId },
            });
            available = (varInv?.quantity ?? 0) - (varInv?.reservedQty ?? 0);
          } else {
            const inv = await this.prisma.inventory.findFirst({
              where: { productId: product.id, warehouseId },
            });
            available = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
          }

          if (available < item.quantity) {
            throw new ConflictException({
              code: "CONFLICT",
              message: `Insufficient stock. Only ${available} available for ${displayName}.`,
              productId: product.id,
              variantId: item.variantId,
              available,
            });
          }

          // ── Structural Pricing Logic ──
          if (dto.source === "PORTAL") {
            if (customer.type === "INDIVIDUAL") {
              // B2C assumes final price is the sellingPrice (which is inclusive of GST)
              // We reverse-calculate the tax-exclusive base price strictly from sellingPrice
              actualPrice = r2(baseSellingPrice / (1 + product.gstRate / 100));
              actualDiscount = 0;
            } else {
              actualPrice = baseSellingPrice; // B2B assumes sellingPrice is tax-exclusive
              if (customer.tier === "GOLD") {
                actualDiscount = r2(actualPrice * item.quantity * 0.05); // 5% bulk discount
              } else if (customer.tier === "SILVER") {
                actualDiscount = r2(actualPrice * item.quantity * 0.025); // 2.5% bulk discount
              } else {
                actualDiscount = 0; // BRONZE gets standard selling price
              }
            }
          } else {
            // WEB / manual distributor order: preserve user-specified price & discount (falling back to baseSellingPrice)
            actualPrice = item.price !== undefined ? item.price : baseSellingPrice;
            actualDiscount = item.discount ?? 0;
          }
        }


        const lineTotal = r2(actualPrice * item.quantity);
        const disc = r2(actualDiscount);
        const taxable = r2(lineTotal - disc);
        const tax = r2((taxable * product.gstRate) / 100);

        totalAmount += lineTotal;
        discountAmount += disc;
        taxAmount += tax;
        return {
          ...item,
          price: actualPrice,
          discount: actualDiscount,
          taxRate: product.gstRate,
          taxAmount: tax,
          totalAmount: r2(taxable + tax),
        };
      }),
    );

    const netAmount = r2(totalAmount - discountAmount + taxAmount);

    // ─── Credit Limit & Overdue Safeguards ──────────────────────────────
    if (!dto.overrideCreditLimit && customer.creditLimit > 0) {
      const newTotal = r2(customer.outstandingAmount + netAmount);
      if (newTotal > customer.creditLimit) {
        throw new BadRequestException({
          code: "CREDIT_LIMIT_EXCEEDED",
          message: `Customer credit limit (₹${customer.creditLimit.toLocaleString("en-IN")}) exceeded. Current outstanding: ₹${customer.outstandingAmount.toLocaleString("en-IN")}, Order value: ₹${netAmount.toLocaleString("en-IN")}, New total would be ₹${newTotal.toLocaleString("en-IN")}.`,
          details: {
            creditLimit: customer.creditLimit,
            outstandingAmount: customer.outstandingAmount,
            orderAmount: netAmount,
            newTotal,
          },
        });
      }
    }

    if (!dto.overrideCreditLimit && (customer.creditDays > 0 || customer.gracePeriodDays > 0)) {
      const graceDays = customer.gracePeriodDays || 7;
      const cutoffDate = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
      const overdueInvoice = await this.prisma.invoice.findFirst({
        where: {
          orgId,
          customerId: customer.id,
          status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
          balanceAmount: { gt: 0 },
          dueDate: { lt: cutoffDate },
        },
        select: { invoiceNumber: true, dueDate: true, balanceAmount: true },
      });
      if (overdueInvoice) {
        throw new BadRequestException({
          code: "OVERDUE_PAYMENT_BLOCKED",
          message: `Customer has overdue invoice ${overdueInvoice.invoiceNumber} (Balance: ₹${overdueInvoice.balanceAmount.toLocaleString("en-IN")}) past the ${graceDays}-day grace period. Payment required before new orders can be created.`,
          details: overdueInvoice,
        });
      }
    }

    const orderNumber = await this.generateOrderNumber(orgId);

    const order = await this.prisma.order.create({
      data: {
        orgId,
        orderNumber,
        customerId: dto.customerId,
        warehouseId,
        source: (dto.source as "APP") ?? "APP",
        notes: dto.notes,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
        commissionTo: dto.commissionTo || undefined,
        commissionType: dto.commissionType || undefined,
        commissionValue: dto.commissionValue ?? undefined,
        totalAmount,
        discountAmount,
        taxAmount,
        netAmount,
        balanceAmount: netAmount,
        items: {
          create: itemsWithTax.map((i: any) => ({
            productId: i.productId,
            variantId: i.variantId || undefined,
            quantity: i.quantity,
            orderedQty: i.quantity,
            deliveredQty: 0,
            pendingQty: i.quantity,
            returnedQty: 0,
            cancelledQty: 0,
            unit: i.unit,
            price: i.price,
            discount: i.discount ?? 0,
            taxRate: i.taxRate,
            taxAmount: i.taxAmount,
            totalAmount: i.totalAmount,
          })),
        },
        statusHistory: { create: { toStatus: "DRAFT", changedBy: userId } },
      },
      include: { items: true },
    });

    await this.invalidateAnalytics(orgId);
    this.eventsService.emit(orgId, 'order:created', { id: order.id, orderNumber: order.orderNumber, netAmount: order.netAmount });

    // Dispatch Web Push notification to distributor owner / admins
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
        select: { name: true },
      });
      await this.notificationsService.notify(orgId, {
        type: 'NEW_ORDER',
        orgId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: customer?.name,
        netAmount: Number(order.netAmount),
        source: order.source,
      });
    } catch (notifErr) {
      this.logger.warn(`Failed to dispatch order notification: ${(notifErr as Error).message}`);
    }

    return order;
  }

  async findOne(orgId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true, unit: true } },
            variant: { select: { id: true, name: true, sku: true, attributes: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: "asc" } },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            outstandingAmount: true,
            paymentScore: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            paidAmount: true,
            balanceAmount: true,
          },
        },
      },
    });
    if (!order)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    return order;
  }

  async updateDraft(orgId: string, id: string, dto: import('./dto/orders.dto').UpdateDraftOrderDto) {
    const order = await this.prisma.order.findFirst({ where: { id, orgId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (order.status !== 'DRAFT') throw new BadRequestException({ code: 'INVALID_STATUS', message: 'Only DRAFT orders can be edited' });

    return this.prisma.$transaction(async (tx: any) => {
      const updateData: Record<string, unknown> = {};
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.deliveryDate !== undefined) updateData.deliveryDate = dto.deliveryDate ? new Date(dto.deliveryDate) : null;

      if (dto.items && dto.items.length > 0) {
        // Recalculate totals
        let totalAmount = 0, discountAmount = 0, taxAmount = 0;
        const itemsWithTax = await Promise.all(
          dto.items.map(async (item: any) => {
            const product = await tx.product.findFirst({ where: { id: item.productId, orgId } });
            if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: `Product ${item.productId} not found` });
            const lineTotal = item.price * item.quantity;
            const disc = item.discount ?? 0;
            const taxable = lineTotal - disc;
            const tax = (taxable * product.gstRate) / 100;
            totalAmount += lineTotal;
            discountAmount += disc;
            taxAmount += tax;
            return { ...item, taxRate: product.gstRate, taxAmount: tax, totalAmount: taxable + tax };
          }),
        );
        const netAmount = totalAmount - discountAmount + taxAmount;

        // Delete old items and create new
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: itemsWithTax.map((i: any) => ({
            orderId: id, productId: i.productId, quantity: i.quantity,
            orderedQty: i.quantity, deliveredQty: 0, pendingQty: i.quantity, returnedQty: 0, cancelledQty: 0,
            unit: i.unit, price: i.price, discount: i.discount ?? 0, taxRate: i.taxRate, taxAmount: i.taxAmount, totalAmount: i.totalAmount,
          })),
        });

        updateData.totalAmount = totalAmount;
        updateData.discountAmount = discountAmount;
        updateData.taxAmount = taxAmount;
        updateData.netAmount = netAmount;
        updateData.balanceAmount = netAmount;
      }

      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: { items: { include: { product: { select: { name: true, sku: true, unit: true } } } }, customer: { select: { id: true, name: true, phone: true, outstandingAmount: true, paymentScore: true } }, statusHistory: { orderBy: { createdAt: 'asc' } } },
      });

      await this.invalidateAnalytics(orgId);
      return updated;
    });
  }

  async confirm(orgId: string, id: string, userId: string, overrideReason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: {
        items: { include: { product: { select: { name: true, hsnCode: true } } } },
        customer: true,
      },
    });
    if (!order) throw new NotFoundException({ code: "NOT_FOUND", message: "Order not found" });
    if (order.status !== "DRAFT") throw new BadRequestException({ code: "UNPROCESSABLE", message: `Cannot confirm order in status ${order.status}` });

    // --- CREDIT CHECK ---
    if (!overrideReason && order.customer.creditLimit > 0) {
      const newTotal = order.customer.outstandingAmount + (order.balanceAmount ?? order.netAmount);
      if (newTotal > order.customer.creditLimit) {
        throw new BadRequestException({
          code: "CREDIT_LIMIT_EXCEEDED",
          message: `Customer credit limit (₹${order.customer.creditLimit}) exceeded. New total would be ₹${newTotal}.`
        });
      }

      // Check for overdue invoices beyond grace period
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - order.customer.gracePeriodDays);

      const overdueInvoice = await this.prisma.invoice.findFirst({
        where: { orgId, customerId: order.customerId, status: { in: ['PARTIAL', 'OVERDUE'] }, dueDate: { lt: overdueDate } }
      });

      if (overdueInvoice) {
        throw new BadRequestException({
          code: "OVERDUE_INVOICES",
          message: `Customer has un-paid invoices overdue beyond their grace period of ${order.customer.gracePeriodDays} days.`
        });
      }
    }

    // Check inventory AND reserve inside a single transaction with row-level locks
    await this.prisma.$transaction(async (tx: any) => {
      const shortages: {
        productId: string;
        needed: number;
        available: number;
      }[] = [];

      for (const item of order.items) {
        // Lock the inventory row to prevent concurrent modifications
        let locked: Array<{ quantity: number; reservedQty: number }>;
        if (item.variantId) {
          locked = await tx.$queryRaw<
            Array<{ quantity: number; reservedQty: number }>
          >`
            SELECT "quantity", "reservedQty" FROM "VariantInventory"
            WHERE "variantId" = ${item.variantId} AND "warehouseId" = ${order.warehouseId}
            FOR UPDATE
          `;
        } else {
          locked = await tx.$queryRaw<
            Array<{ quantity: number; reservedQty: number }>
          >`
            SELECT "quantity", "reservedQty" FROM "Inventory"
            WHERE "productId" = ${item.productId} AND "warehouseId" = ${order.warehouseId}
            FOR UPDATE
          `;
        }
        const inv = locked[0];
        const available = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
        if (available < item.quantity) {
          shortages.push({
            productId: item.productId,
            needed: item.quantity,
            available,
          });
        }
      }

      if (shortages.length > 0) {
        throw new ConflictException({
          code: "CONFLICT",
          message: "Insufficient stock for some items",
          details: shortages,
        });
      }

      await tx.order.update({ where: { id }, data: { status: "CONFIRMED" } });
      for (const item of order.items) {
        if (item.variantId) {
          await tx.variantInventory.updateMany({
            where: { variantId: item.variantId, warehouseId: order.warehouseId },
            data: { reservedQty: { increment: item.quantity } },
          });
        } else {
          await tx.inventory.updateMany({
            where: { productId: item.productId, warehouseId: order.warehouseId },
            data: { reservedQty: { increment: item.quantity } },
          });
        }
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: "DRAFT",
          toStatus: "CONFIRMED",
          changedBy: userId,
        },
      });
    });

    // --- AUTO-GENERATE INVOICE ---
    if (!order.invoiceId) {
      const invoiceDto = {
        customerId: order.customerId,
        orderId: order.id,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + order.customer.creditDays * 24 * 60 * 60 * 1000).toISOString(),
        notes: order.notes,
        items: order.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          discount: item.discount ?? 0,
          hsnCode: item.product?.hsnCode,
        })),
      };

      await this.invoices.create(orgId, invoiceDto as any);
      // Auto-generate invoice
    }

    // Auto-dispatch WhatsApp order confirmation & payment link to customer
    this.sendWhatsAppConfirmation(orgId, id).catch((err) => {
      this.logger.warn(`Background WhatsApp confirmation dispatch for order ${id}: ${(err as Error).message}`);
    });

    await this.invalidateAnalytics(orgId);
    this.eventsService.emit(orgId, 'order:status_changed', { id, status: 'CONFIRMED' });
    return { success: true, status: "CONFIRMED" };
  }

  async markPaid(orgId: string, id: string, userId: string, dto: MarkPaidDto | string = {}) {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const resolvedDto: MarkPaidDto = typeof dto === 'string' ? { method: dto as any } : (dto || {});
    const method = resolvedDto.method || 'CASH';
    const paymentDate = resolvedDto.date ? new Date(resolvedDto.date) : new Date();

    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: { customer: { select: { id: true, name: true } }, invoice: true },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });

    let invoiceId = order.invoiceId;
    if (!invoiceId) throw new BadRequestException({ code: 'NO_INVOICE', message: 'Order has no invoice. Please confirm it first.' });

    const invoice = order.invoice || await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });

    const balanceAmount = r2(invoice.balanceAmount);
    const actualPayment = resolvedDto.amount && resolvedDto.amount > 0
      ? r2(Math.min(resolvedDto.amount, balanceAmount > 0 ? balanceAmount : order.netAmount))
      : (balanceAmount > 0 ? balanceAmount : r2(order.netAmount));

    if (actualPayment > 0) {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${order.customerId} FOR UPDATE`;
        const payment = await tx.payment.create({
          data: {
            orgId,
            customerId: order.customerId,
            invoiceId,
            amount: actualPayment,
            method,
            referenceNumber: resolvedDto.referenceNumber || null,
            status: 'COMPLETED',
            paidAt: paymentDate,
            notes: resolvedDto.notes || `Payment for Order ${order.orderNumber} (${method})`,
          }
        });

        const newPaid = r2(Number(invoice.paidAmount) + actualPayment);
        const newBal = r2(Math.max(0, Number(invoice.balanceAmount) - actualPayment));

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaid,
            balanceAmount: newBal,
            status: newBal <= 0 ? 'PAID' : 'PARTIAL',
          }
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId,
            amountAllocated: actualPayment
          }
        });

        const newOrderPaid = r2(Number(order.paidAmount) + actualPayment);
        const newOrderBal = r2(Math.max(0, Number(order.balanceAmount) - actualPayment));

        await tx.order.update({
          where: { id: order.id },
          data: {
            paidAmount: newOrderPaid,
            balanceAmount: newOrderBal,
          }
        });

        // ── Create CustomerTransaction so payment shows in Customer Khata / Statement ──
        await tx.customerTransaction.create({
          data: {
            orgId,
            customerId: order.customerId,
            date: paymentDate,
            type: 'PAYMENT',
            amount: new Prisma.Decimal(actualPayment),
            paymentMethod: method as any,
            reference: resolvedDto.referenceNumber || invoice.invoiceNumber,
            description: resolvedDto.notes || `Payment for Order ${order.orderNumber} (${method})`,
            notes: `Auto-recorded via Mark Paid for Order ${order.orderNumber} (Payment ID: ${payment.id})`,
          }
        });

        // Authoritatively recompute Customer.outstandingAmount from CustomerTransaction
        const allTx = await tx.customerTransaction.findMany({
          where: { orgId, customerId: order.customerId },
          select: { type: true, amount: true },
        });
        const summary = CustomerLedgerCalculationEngine.computeSummary(allTx);

        const customer = await tx.customer.update({
          where: { id: order.customerId },
          data: { outstandingAmount: summary.netBalance },
          select: { outstandingAmount: true }
        });

        await tx.ledgerEntry.create({
          data: {
            orgId,
            customerId: order.customerId,
            type: 'CREDIT',
            amount: actualPayment,
            balance: customer.outstandingAmount,
            referenceId: payment.id,
            referenceType: 'PAYMENT',
            notes: resolvedDto.notes || `Payment recorded for Order ${order.orderNumber}`
          }
        });
      });
    }

    // Invalidate cache AFTER transaction commits (#9)
    await Promise.all([
      this.redis.del(`analytics:dashboard:${orgId}`),
      this.redis.del(`analytics:sales:${orgId}`),
    ]);

    return { success: true };
  }

  async pack(orgId: string, id: string, userId: string) {
    return this.transitionStatus(orgId, id, "CONFIRMED", "PACKED", userId);
  }

  async dispatch(
    orgId: string,
    id: string,
    dto: DispatchOrderDto,
    userId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: { items: true },
    });
    if (!order)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    if (!["CONFIRMED", "PACKED", "DISPATCHED", "PARTIALLY_DELIVERED"].includes(order.status)) {
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: `Cannot dispatch order in status ${order.status}`,
      });
    }

    // Determine dispatch quantities per line item
    const dispatchMap = new Map<string, number>();
    if (dto.items && dto.items.length > 0) {
      for (const itemDto of dto.items) {
        const orderItem = order.items.find((i: any) => i.id === itemDto.orderItemId);
        if (!orderItem) {
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: `OrderItem ${itemDto.orderItemId} not found in this order`,
          });
        }
        if (itemDto.dispatchQty < 0) {
          throw new BadRequestException({
            code: "INVALID_QUANTITY",
            message: "Dispatch quantity cannot be negative",
          });
        }
        const ordered = orderItem.orderedQty > 0 ? orderItem.orderedQty : orderItem.quantity;
        const currentPending = orderItem.pendingQty > 0
          ? orderItem.pendingQty
          : Math.max(0, ordered - orderItem.deliveredQty - orderItem.cancelledQty);

        if (itemDto.dispatchQty > currentPending) {
          throw new BadRequestException({
            code: "OVER_DELIVERY",
            message: `Dispatch qty (${itemDto.dispatchQty}) exceeds pending qty (${currentPending}) for item ${orderItem.productId}`,
          });
        }
        dispatchMap.set(orderItem.id, itemDto.dispatchQty);
      }
    } else {
      // Default: dispatch all remaining pending quantities
      for (const item of order.items) {
        const ordered = item.orderedQty > 0 ? item.orderedQty : item.quantity;
        const currentPending = item.pendingQty > 0
          ? item.pendingQty
          : Math.max(0, ordered - item.deliveredQty - item.cancelledQty);
        dispatchMap.set(item.id, currentPending);
      }
    }

    const totalDispatchedThisBatch = Array.from(dispatchMap.values()).reduce((sum, q) => sum + q, 0);
    if (totalDispatchedThisBatch <= 0) {
      throw new BadRequestException({
        code: "NO_QUANTITY",
        message: "At least one item must have a dispatch quantity greater than 0",
      });
    }

    let finalStatus: "PARTIALLY_DELIVERED" | "DELIVERED" = "DELIVERED";

    await this.prisma.$transaction(async (tx: any) => {
      for (const item of order.items) {
        const dispatchQty = dispatchMap.get(item.id) ?? 0;
        if (dispatchQty <= 0) continue;

        const ordered = item.orderedQty > 0 ? item.orderedQty : item.quantity;
        const newDelivered = item.deliveredQty + dispatchQty;
        const newPending = Math.max(0, ordered - newDelivered - item.cancelledQty);

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            deliveredQty: newDelivered,
            pendingQty: newPending,
          },
        });

        // Deduct inventory physical stock and reservedQty
        if (item.variantId) {
          await tx.variantInventory.updateMany({
            where: { variantId: item.variantId, warehouseId: order.warehouseId },
            data: {
              quantity: { decrement: dispatchQty },
              reservedQty: { decrement: dispatchQty },
            },
          });
        } else {
          await tx.inventory.updateMany({
            where: { productId: item.productId, warehouseId: order.warehouseId },
            data: {
              quantity: { decrement: dispatchQty },
              reservedQty: { decrement: dispatchQty },
            },
          });
        }

        const inv = await tx.inventory.findFirst({
          where: { productId: item.productId, warehouseId: order.warehouseId },
        });
        if (inv) {
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inv.id,
              type: "OUT",
              quantity: -dispatchQty,
              referenceId: id,
              referenceType: "ORDER",
              createdBy: userId,
            },
          });
        }
      }

      // Check all items to see if any pending remain
      const allUpdatedItems = await tx.orderItem.findMany({ where: { orderId: id } });
      const hasPending = allUpdatedItems.some((it: any) => {
        const ordered = it.orderedQty > 0 ? it.orderedQty : it.quantity;
        const computed = Math.max(0, ordered - (it.deliveredQty || 0) - (it.cancelledQty || 0));
        const pending = typeof it.pendingQty === "number" && it.pendingQty > 0 ? Math.min(it.pendingQty, computed) : computed;
        return pending > 0;
      });

      finalStatus = hasPending ? "PARTIALLY_DELIVERED" : "DELIVERED";

      await tx.order.update({
        where: { id },
        data: { status: finalStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: finalStatus,
          note: dto.vehicleNumber,
          changedBy: userId,
        },
      });
    });

    await this.invalidateAnalytics(orgId);
    this.eventsService.emit(orgId, 'order:status_changed', { id, status: finalStatus });
    return { success: true, status: finalStatus };
  }

  async deliver(orgId: string, id: string, userId: string) {
    return this.transitionStatus(orgId, id, "DISPATCHED", "DELIVERED", userId);
  }

  async cancel(orgId: string, id: string, userId: string) {
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: { items: true },
    });
    if (!order)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    if (!["DRAFT", "CONFIRMED", "PACKED"].includes(order.status)) {
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: `Cannot cancel order in status ${order.status} `,
      });
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${order.customerId} FOR UPDATE`;

      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });

      // Release reserved inventory for confirmed/packed orders
      if (["CONFIRMED", "PACKED"].includes(order.status)) {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.variantInventory.updateMany({
              where: {
                variantId: item.variantId,
                warehouseId: order.warehouseId,
              },
              data: { reservedQty: { decrement: item.quantity } },
            });
          } else {
            await tx.inventory.updateMany({
              where: {
                productId: item.productId,
                warehouseId: order.warehouseId,
              },
              data: { reservedQty: { decrement: item.quantity } },
            });
          }
        }
      }

      // Void linked invoice and reverse customer outstanding (#3)
      if (order.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: order.invoiceId } });
        if (invoice && invoice.status !== 'CANCELLED') {
          const balanceToReverse = r2(invoice.balanceAmount);

          await tx.invoice.update({
            where: { id: order.invoiceId },
            data: { status: 'CANCELLED', balanceAmount: 0 },
          });

          if (balanceToReverse > 0) {
            const customer = await tx.customer.update({
              where: { id: order.customerId },
              data: { outstandingAmount: { decrement: balanceToReverse } },
              select: { outstandingAmount: true },
            });

            await tx.ledgerEntry.create({
              data: {
                orgId,
                customerId: order.customerId,
                type: 'CREDIT',
                amount: balanceToReverse,
                balance: customer.outstandingAmount,
                referenceId: order.invoiceId,
                referenceType: 'CANCELLATION',
                notes: `Invoice cancelled due to order cancellation`,
              },
            });
          }
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status as "DRAFT",
          toStatus: "CANCELLED",
          changedBy: userId,
        },
      });
    });

    await this.invalidateAnalytics(orgId);
    this.eventsService.emit(orgId, 'order:status_changed', { id, status: 'CANCELLED' });
    return { success: true, status: "CANCELLED" };
  }

  async returnOrder(
    orgId: string,
    id: string,
    dto: ReturnOrderDto,
    userId: string,
  ) {
    const original = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: { items: true },
    });
    if (!original)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    if (!["DELIVERED", "PARTIALLY_DELIVERED", "COMPLETED"].includes(original.status))
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: "Can only return delivered orders",
      });

    const txResult = await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${original.customerId} FOR UPDATE`;

      const r2 = (n: number) => Math.round(n * 100) / 100;
      const returnNumber = await this.generateOrderNumber(orgId);

      // If items weren't provided, default to returning everything delivered
      const itemsToReturn = dto.items && dto.items.length > 0
        ? dto.items.map((i: any) => ({
            orderItemId: i.orderItemId,
            returnQty: Number(i.returnQty ?? i.quantity ?? 0),
            reason: i.reason,
            condition: (i.condition ?? 'RESTOCKABLE') as 'RESTOCKABLE' | 'DAMAGED',
          }))
        : original.items.map((i: any) => ({
          orderItemId: i.id,
          returnQty: Math.max(0, (i.deliveredQty > 0 ? i.deliveredQty : i.quantity) - (i.returnedQty || 0)),
          reason: dto.reason ?? "Returned entirely",
          condition: "RESTOCKABLE" as const,
        })).filter(i => i.returnQty > 0);

      if (itemsToReturn.length === 0) {
        throw new BadRequestException({
          code: "NOTHING_TO_RETURN",
          message: "No delivered items remaining to return",
        });
      }

      // Build return items and calculate return value
      let returnTotalAmount = 0;
      let returnDiscountAmount = 0;
      let returnTaxAmount = 0;
      let returnNetAmount = 0;

      const returnItems = itemsToReturn.map((ri) => {
        const origItem = original.items.find(
          (i: any) => i.id === ri.orderItemId,
        );
        if (!origItem)
          throw new BadRequestException({
            code: "NOT_FOUND",
            message: `OrderItem ${ri.orderItemId} not found`,
          });

        const delivered = origItem.deliveredQty > 0 ? origItem.deliveredQty : origItem.quantity;
        const alreadyReturned = origItem.returnedQty ?? 0;
        const returnable = Math.max(0, delivered - alreadyReturned);

        if (ri.returnQty > returnable)
          throw new BadRequestException({
            code: "CONFLICT",
            message: `Return qty (${ri.returnQty}) exceeds delivered returnable qty (${returnable}) for product ${origItem.productId}`,
          });

        const ratio = origItem.quantity > 0 ? ri.returnQty / origItem.quantity : 1;
        const lineTotal = r2((origItem.price * origItem.quantity) * ratio); // Tax-exclusive
        const lineDiscount = r2((origItem.discount || 0) * ratio);
        const lineTax = r2((origItem.taxAmount || 0) * ratio);
        const lineNet = r2(lineTotal - lineDiscount + lineTax);

        returnTotalAmount += lineTotal;
        returnDiscountAmount += lineDiscount;
        returnTaxAmount += lineTax;
        returnNetAmount += lineNet;

        return {
          productId: origItem.productId,
          quantity: ri.returnQty,
          orderedQty: ri.returnQty,
          deliveredQty: ri.returnQty,
          pendingQty: 0,
          returnedQty: 0,
          cancelledQty: 0,
          unit: origItem.unit,
          price: origItem.price,
          discount: lineDiscount,
          taxRate: origItem.taxRate,
          taxAmount: lineTax,
          totalAmount: lineNet,
        };
      });

      returnTotalAmount = r2(returnTotalAmount);
      returnDiscountAmount = r2(returnDiscountAmount);
      returnTaxAmount = r2(returnTaxAmount);
      returnNetAmount = r2(returnNetAmount);

      const returnOrder = await tx.order.create({
        data: {
          orgId,
          orderNumber: `RET-${returnNumber}`,
          customerId: original.customerId,
          warehouseId: original.warehouseId,
          status: "RETURNED",
          type: "RETURN",
          totalAmount: returnTotalAmount,
          discountAmount: returnDiscountAmount,
          taxAmount: returnTaxAmount,
          netAmount: returnNetAmount,
          items: { create: returnItems },
        },
        include: { items: true },
      });

      // Update original line items returnedQty and conditionally restore inventory
      for (const ri of itemsToReturn) {
        const origItem = original.items.find((i: any) => i.id === ri.orderItemId);
        if (!origItem) continue;

        await tx.orderItem.update({
          where: { id: origItem.id },
          data: { returnedQty: { increment: ri.returnQty } },
        });

        const isRestockable = ri.condition !== "DAMAGED";
        const inv = await tx.inventory.findFirst({
          where: {
            productId: origItem.productId,
            warehouseId: original.warehouseId,
          },
        });

        if (inv) {
          if (isRestockable) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: { increment: ri.returnQty } },
            });
            await tx.inventoryTransaction.create({
              data: {
                inventoryId: inv.id,
                type: "RETURN",
                quantity: ri.returnQty,
                referenceId: id,
                referenceType: "RETURN",
                createdBy: userId,
                note: "Restockable customer return",
              },
            });
          } else {
            // Damaged goods do NOT inflate sellable inventory; log audit entry
            await tx.inventoryTransaction.create({
              data: {
                inventoryId: inv.id,
                type: "RETURN",
                quantity: 0,
                referenceId: id,
                referenceType: "RETURN_DAMAGED",
                createdBy: userId,
                note: `Damaged return of ${ri.returnQty} units — quarantined without increasing sellable stock`,
              },
            });
          }
        }
      }

      // Check whether original order is fully or partially returned
      const allOrigItems = await tx.orderItem.findMany({ where: { orderId: original.id } });
      const isFullyReturned = allOrigItems.every((it: any) => {
        const del = it.deliveredQty > 0 ? it.deliveredQty : it.quantity;
        return it.returnedQty >= del;
      });

      await tx.order.update({
        where: { id: original.id },
        data: { status: isFullyReturned ? "RETURNED" : "PARTIALLY_RETURNED" },
      });

      // ── GST Credit Note + Financial Reversal ──
      if (original.invoiceId && returnNetAmount > 0) {
        const invoice = await tx.invoice.findUnique({
          where: { id: original.invoiceId },
          include: { items: true },
        });
        if (invoice) {
          // Calculate proportional GST from original InvoiceItems
          let cnCgst = 0, cnSgst = 0, cnIgst = 0, cnCess = 0, cnSubtotal = 0;

          for (const ri of itemsToReturn) {
            const origOrderItem = original.items.find((i: any) => i.id === ri.orderItemId);
            if (!origOrderItem) continue;

            // Find matching InvoiceItem by productId
            const invoiceItem = invoice.items.find(
              (ii: any) => ii.productId === origOrderItem.productId,
            );
            if (!invoiceItem) continue;

            // Pro-rate tax amounts: (returnQty / originalQty) * taxAmount
            const ratio = ri.returnQty / invoiceItem.quantity;
            cnCgst += r2(invoiceItem.cgstAmount * ratio);
            cnSgst += r2(invoiceItem.sgstAmount * ratio);
            cnIgst += r2(invoiceItem.igstAmount * ratio);
            cnCess += r2((invoiceItem.cessRate * invoiceItem.taxableAmt / 100) * ratio);
            cnSubtotal += r2(invoiceItem.taxableAmt * ratio);
          }

          cnCgst = r2(cnCgst);
          cnSgst = r2(cnSgst);
          cnIgst = r2(cnIgst);
          cnCess = r2(cnCess);
          cnSubtotal = r2(cnSubtotal);
          const cnTotal = r2(cnSubtotal + cnCgst + cnSgst + cnIgst + cnCess);

          // Generate credit note number
          const cnCount = await tx.creditNote.count({ where: { orgId } });
          const creditNoteNumber = `CN-${String(cnCount + 1).padStart(5, '0')}`;

          // Mint the CreditNote
          const creditNote = await tx.creditNote.create({
            data: {
              orgId,
              creditNoteNumber,
              customerId: original.customerId,
              invoiceId: original.invoiceId,
              returnOrderId: returnOrder.id,
              creditNoteDate: new Date(),
              originalInvoiceDate: invoice.invoiceDate,
              reason: dto.reason ?? 'Goods returned',
              subtotal: cnSubtotal,
              cgstAmount: cnCgst,
              sgstAmount: cnSgst,
              igstAmount: cnIgst,
              cessAmount: cnCess,
              totalAmount: cnTotal,
              status: 'ISSUED',
            },
          });

          // Adjust the invoice balance
          const newBalance = r2(Math.max(0, invoice.balanceAmount - cnTotal));
          const adjustedPaid = r2(Math.max(0, invoice.paidAmount - cnTotal));
          const newStatus = newBalance <= 0 ? 'PAID' : (adjustedPaid > 0 ? 'PARTIAL' : invoice.status);

          await tx.invoice.update({
            where: { id: original.invoiceId },
            data: {
              balanceAmount: newBalance,
              totalAmount: r2(invoice.totalAmount - cnTotal),
              paidAmount: adjustedPaid,
              status: newStatus,
            },
          });

          // Decrement customer outstanding
          if (cnTotal > 0) {
            const customer = await tx.customer.update({
              where: { id: original.customerId },
              data: { outstandingAmount: { decrement: cnTotal } },
              select: { outstandingAmount: true },
            });

            await tx.ledgerEntry.create({
              data: {
                orgId,
                customerId: original.customerId,
                type: 'CREDIT',
                amount: cnTotal,
                balance: customer.outstandingAmount,
                referenceId: creditNote.id,
                referenceType: 'CREDIT_NOTE',
                notes: `Credit Note ${creditNoteNumber} against invoice ${invoice.invoiceNumber}`,
              },
            });

            await tx.customerTransaction.create({
              data: {
                orgId,
                customerId: original.customerId,
                date: new Date(),
                type: 'RETURN',
                amount: new Prisma.Decimal(cnTotal),
                reference: creditNoteNumber,
                description: dto.reason || `Credit Note ${creditNoteNumber} for returned goods`,
                notes: `Issued from Credit Note ${creditNoteNumber} against invoice ${invoice.invoiceNumber}`,
              },
            });
          }
        }
      }

      return returnOrder;
    });
    await this.invalidateAnalytics(orgId);
    return txResult;
  }

  private async transitionStatus(
    orgId: string,
    id: string,
    from: string,
    to: string,
    userId: string,
  ) {
    const order = await this.prisma.order.findFirst({ where: { id, orgId } });
    if (!order)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    if (order.status !== from)
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: `Cannot move to ${to} from ${order.status} `,
      });
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: to as "PACKED" | "DELIVERED" },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: from as "CONFIRMED",
          toStatus: to as "PACKED",
          changedBy: userId,
        },
      }),
    ]);
    await this.invalidateAnalytics(orgId);
    return { success: true, status: to };
  }

  /**
   * Dispatches an automated WhatsApp order confirmation with item summary,
   * active Razorpay / UPI payment link, and PDF invoice link to the customer.
   */
  async sendWhatsAppConfirmation(orgId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: {
        customer: true,
        items: {
          include: {
            product: { select: { name: true, unit: true } },
            variant: { select: { name: true } },
          },
        },
        invoice: true,
        organization: {
          include: { settings: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Order not found" });
    }

    if (!order.customer || !order.customer.phone) {
      throw new BadRequestException({ code: "NO_PHONE", message: "Customer has no phone number on record" });
    }

    const cleanPhone = order.customer.phone.replace(/[^0-9]/g, "");
    const to = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const dueAmount = order.balanceAmount > 0
      ? order.balanceAmount
      : (order.invoice ? order.invoice.balanceAmount : order.netAmount);

    let paymentLinkUrl: string | undefined;

    // 1. Generate Razorpay payment link if balance is due
    if (dueAmount > 0) {
      try {
        const link = await this.razorpay.createPaymentLink({
          amount: Math.round(dueAmount * 100),
          currency: "INR",
          description: `Payment for Order #${order.orderNumber}`,
          customerName: order.customer.name,
          customerPhone: cleanPhone.slice(-10),
          customerEmail: order.customer.email || undefined,
          referenceId: `ord_${order.id}_${Date.now()}`,
          notifyWhatsapp: false,
        });
        paymentLinkUrl = link.shortUrl;
      } catch (rzpErr) {
        this.logger.warn(`Razorpay payment link error: ${(rzpErr as Error).message}`);
      }
    }

    // 2. Format 1-Tap UPI link if org has UPI ID configured
    const upiId = order.organization?.settings?.upiId;
    let upiBlock = "";
    if (upiId && dueAmount > 0) {
      const orgDisplayName = order.organization.name || "Distributor";
      const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(orgDisplayName)}&am=${dueAmount.toFixed(2)}&tr=${encodeURIComponent(order.orderNumber)}&tn=Order+${encodeURIComponent(order.orderNumber)}&cu=INR`;
      upiBlock = `\n💳 *Instant 1-Tap UPI:*\n• Payee UPI: \`${upiId}\`\n• Pay directly: ${upiUri}\n`;
    }

    // 3. Format items list
    const itemsLines = order.items.slice(0, 5).map((it, idx) => {
      const itemName = it.variant?.name ? `${it.product?.name} (${it.variant.name})` : (it.product?.name || "Item");
      return `${idx + 1}. *${itemName}* × ${it.quantity} ${it.unit || "Pcs"} — ₹${it.totalAmount.toLocaleString("en-IN")}`;
    }).join("\n");
    const moreItems = order.items.length > 5 ? `\n_...and ${order.items.length - 5} more items_\n` : "\n";

    // 4. Payment instructions
    let paymentText = "";
    if (dueAmount > 0) {
      paymentText = `\n💰 *Amount Due: ₹${dueAmount.toLocaleString("en-IN")}*\n`;
      if (paymentLinkUrl) {
        paymentText += `👉 *Pay Online (UPI / GPay / PhonePe / Cards):*\n${paymentLinkUrl}\n`;
      }
      if (upiBlock) {
        paymentText += upiBlock;
      }
    } else {
      paymentText = `\n✅ *Payment Status: Paid in Full*\n`;
    }

    const orgName = order.organization?.name || "DistroAI";
    const appUrl = process.env.APP_URL || "https://distroai.in";
    const viewUrl = order.invoice?.pdfUrl || `${appUrl}/orders/${order.id}`;

    const textMessage =
      `📦 *Order Confirmed — ${orgName}*\n\n` +
      `Dear *${order.customer.name}*,\n` +
      `Thank you for your order! Here are your order details:\n\n` +
      `📋 *Order Summary:*\n` +
      `• Order No: *#${order.orderNumber}*\n` +
      `• Date: ${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}\n` +
      `• Order Status: *${order.status}*\n` +
      `• Total Amount: *₹${order.netAmount.toLocaleString("en-IN")}*\n\n` +
      `🛍️ *Items:*\n` +
      `${itemsLines}` +
      `${moreItems}` +
      `${paymentText}\n` +
      `📄 *View / Download Invoice:*\n` +
      `${viewUrl}\n\n` +
      (order.organization.phone ? `📞 For questions, call: ${order.organization.phone}` : `Thank you for your business!`);

    await this.wa.sendText(orgId, to, textMessage);

    // Send document PDF attachment if available
    if (order.invoice?.pdfUrl) {
      try {
        await this.wa.sendDocument(
          orgId,
          to,
          order.invoice.pdfUrl,
          `Invoice-${order.orderNumber}.pdf`,
          `Tax Invoice for Order #${order.orderNumber}`,
        );
      } catch (docErr) {
        this.logger.warn(`Failed to attach invoice PDF: ${(docErr as Error).message}`);
      }
    }

    return {
      success: true,
      message: `Order confirmation & payment link sent to WhatsApp (+${to})`,
      to,
      paymentLinkUrl,
    };
  }
}
