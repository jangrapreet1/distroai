import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/services/redis.service";
import {
  CreateOrderDto,
  ReturnOrderDto,
  DispatchOrderDto,
  ListOrdersQueryDto,
} from "./dto/orders.dto";
import { InvoicesService } from "../invoices/invoices.service";
import { EventsService } from "../events/events.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly invoices: InvoicesService,
    private readonly eventsService: EventsService,
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
    return `${prefix} -${String(count + 1).padStart(5, "0")} `;
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

        const isSelfServe = dto.source === "PORTAL" || dto.source === "WEB";

        let actualPrice = item.price;
        let actualDiscount = item.discount ?? 0;

        if (isSelfServe) {
          // ── Real-time Inventory Block ──
          const inv = await this.prisma.inventory.findFirst({
            where: { productId: product.id, warehouseId },
          });
          const available = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
          if (available < item.quantity) {
            throw new ConflictException({
              code: "CONFLICT",
              message: `Insufficient stock. Only ${available} available for ${product.name}.`,
              productId: product.id,
              available,
            });
          }

          // ── Structural Pricing Logic ──
          if (customer.type === "INDIVIDUAL") {
            // B2C assumes final price is the sellingPrice (which is inclusive of GST)
            // We reverse-calculate the tax-exclusive base price strictly from sellingPrice
            actualPrice = r2(product.sellingPrice / (1 + product.gstRate / 100));
            actualDiscount = 0;
          } else {
            actualPrice = product.sellingPrice; // B2B assumes sellingPrice is tax-exclusive
            if (customer.tier === "GOLD") {
              actualDiscount = r2(actualPrice * item.quantity * 0.05); // 5% bulk discount
            } else if (customer.tier === "SILVER") {
              actualDiscount = r2(actualPrice * item.quantity * 0.025); // 2.5% bulk discount
            } else {
              actualDiscount = 0; // BRONZE gets standard selling price
            }
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
            quantity: i.quantity,
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
    return order;
  }

  async findOne(orgId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true, unit: true } },
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
            orderId: id, productId: i.productId, quantity: i.quantity, unit: i.unit,
            price: i.price, discount: i.discount ?? 0, taxRate: i.taxRate, taxAmount: i.taxAmount, totalAmount: i.totalAmount,
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
        const locked = await tx.$queryRaw<
          Array<{ quantity: number; reservedQty: number }>
        >`
                    SELECT "quantity", "reservedQty" FROM "Inventory"
                    WHERE "productId" = ${item.productId} AND "warehouseId" = ${order.warehouseId}
                    FOR UPDATE
                `;
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
        await tx.inventory.updateMany({
          where: { productId: item.productId, warehouseId: order.warehouseId },
          data: { reservedQty: { increment: item.quantity } },
        });
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
      // Stage 5 WhatsApp notification is hooked up within invoices.service.ts
    }

    await this.invalidateAnalytics(orgId);
    this.eventsService.emit(orgId, 'order:status_changed', { id, status: 'CONFIRMED' });
    return { success: true, status: "CONFIRMED" };
  }

  async markPaid(orgId: string, id: string, userId: string, method: 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT' = 'CASH') {
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: { customer: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });

    let invoiceId = order.invoiceId;
    if (!invoiceId) throw new BadRequestException({ code: 'NO_INVOICE', message: 'Order has no invoice. Please confirm it first.' });

    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });

    const balanceAmount = r2(invoice.balanceAmount);

    if (balanceAmount > 0) {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${order.customerId} FOR UPDATE`;
        const payment = await tx.payment.create({
          data: {
            orgId,
            customerId: order.customerId,
            invoiceId,
            amount: balanceAmount,
            method,
            status: 'COMPLETED',
            paidAt: new Date(),
            notes: 'Auto-recorded via Mark Paid flow',
          }
        });

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: { increment: balanceAmount },
            balanceAmount: 0,
            status: 'PAID',
          }
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId,
            amountAllocated: balanceAmount
          }
        });

        // Lock customer row to prevent concurrent race conditions (#7)
        const customer = await tx.customer.update({
          where: { id: order.customerId },
          data: { outstandingAmount: { decrement: balanceAmount } },
          select: { outstandingAmount: true }
        });

        await tx.ledgerEntry.create({
          data: {
            orgId,
            customerId: order.customerId,
            type: 'CREDIT',
            amount: balanceAmount,
            balance: customer.outstandingAmount,
            referenceId: payment.id,
            referenceType: 'PAYMENT',
            notes: `Payment recorded via Mark Paid flow`
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            paidAmount: order.netAmount,
            balanceAmount: 0,
          }
        });
      });
    }

    // Invalidate cache AFTER transaction commits (#9)
    await Promise.all([
      this.redis.del(`analytics:dashboard:${orgId}`),
      this.redis.del(`analytics:sales:${orgId}`)
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
    if (!["CONFIRMED", "PACKED"].includes(order.status)) {
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: `Cannot dispatch order in status ${order.status} `,
      });
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.order.update({ where: { id }, data: { status: "DISPATCHED" } });
      for (const item of order.items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, warehouseId: order.warehouseId },
          data: {
            quantity: { decrement: item.quantity },
            reservedQty: { decrement: item.quantity },
          },
        });
        const inv = await tx.inventory.findFirst({
          where: { productId: item.productId, warehouseId: order.warehouseId },
        });
        if (inv) {
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inv.id,
              type: "OUT",
              quantity: -item.quantity,
              referenceId: id,
              referenceType: "ORDER",
              createdBy: userId,
            },
          });
        }
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status as "CONFIRMED" | "PACKED",
          toStatus: "DISPATCHED",
          note: dto.vehicleNumber,
          changedBy: userId,
        },
      });
    });


    await this.invalidateAnalytics(orgId);
    this.eventsService.emit(orgId, 'order:status_changed', { id, status: 'DISPATCHED' });
    return { success: true, status: "DISPATCHED" };
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
          await tx.inventory.updateMany({
            where: {
              productId: item.productId,
              warehouseId: order.warehouseId,
            },
            data: { reservedQty: { decrement: item.quantity } },
          });
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
    if (original.status !== "DELIVERED")
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: "Can only return DELIVERED orders",
      });

    const txResult = await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${original.customerId} FOR UPDATE`;

      const r2 = (n: number) => Math.round(n * 100) / 100;
      const returnNumber = await this.generateOrderNumber(orgId);

      // If items weren't provided, default to returning everything
      const itemsToReturn = dto.items && dto.items.length > 0
        ? dto.items
        : original.items.map((i: any) => ({
          orderItemId: i.id,
          returnQty: i.quantity,
          reason: dto.reason ?? "Returned entirely",
        }));

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
        if (ri.returnQty > origItem.quantity)
          throw new BadRequestException({
            code: "CONFLICT",
            message: "Return qty exceeds ordered qty",
          });

        const ratio = ri.returnQty / origItem.quantity;
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
          orderNumber: `RET - ${returnNumber} `,
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

      // Restore inventory
      for (const ri of itemsToReturn) {
        const origItem = original.items.find((i: any) => i.id === ri.orderItemId);
        if (!origItem) continue;
        const inv = await tx.inventory.findFirst({
          where: {
            productId: origItem.productId,
            warehouseId: original.warehouseId,
          },
        });
        if (inv) {
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
            },
          });
        }
      }

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
}
