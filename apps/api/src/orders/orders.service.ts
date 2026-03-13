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

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly invoices: InvoicesService,
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
          customer: { select: { name: true } },
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
    let totalAmount = 0,
      discountAmount = 0,
      taxAmount = 0;
    const itemsWithTax = await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, orgId },
        });
        if (!product)
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: `Product ${item.productId} not found`,
          });
        const lineTotal = item.price * item.quantity;
        const disc = item.discount ?? 0;
        const taxable = lineTotal - disc;
        const tax = (taxable * product.gstRate) / 100;
        totalAmount += lineTotal;
        discountAmount += disc;
        taxAmount += tax;
        return {
          ...item,
          taxRate: product.gstRate,
          taxAmount: tax,
          totalAmount: taxable + tax,
        };
      }),
    );

    const netAmount = totalAmount - discountAmount + taxAmount;
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
        totalAmount,
        discountAmount,
        taxAmount,
        netAmount,
        balanceAmount: netAmount,
        items: {
          create: itemsWithTax.map((i) => ({
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

  async confirm(orgId: string, id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, orgId },
      include: { items: true },
    });
    if (!order)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    if (order.status !== "DRAFT")
      throw new BadRequestException({
        code: "UNPROCESSABLE",
        message: `Cannot confirm order in status ${order.status}`,
      });

    // Check inventory AND reserve inside a single transaction with row-level locks
    await this.prisma.$transaction(async (tx) => {
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

    await this.invalidateAnalytics(orgId);
    return { success: true, status: "CONFIRMED" };
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

    await this.prisma.$transaction(async (tx) => {
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

    // Generate an invoice
    await this.invoices.create(orgId, {
      customerId: order.customerId,
      invoiceDate: new Date().toISOString(),
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      })),
      notes: `Auto-generated for Order ${order.orderNumber}`,
    });
    this.logger.log(`Generated invoice for order ${order.orderNumber}`);

    await this.invalidateAnalytics(orgId);
    return { success: true, status: "DISPATCHED" };
  }

  async deliver(orgId: string, id: string, userId: string) {
    return this.transitionStatus(orgId, id, "DISPATCHED", "DELIVERED", userId);
  }

  async cancel(orgId: string, id: string, userId: string) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
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

    const txResult = await this.prisma.$transaction(async (tx) => {
      const returnNumber = await this.generateOrderNumber(orgId);
      const returnOrder = await tx.order.create({
        data: {
          orgId,
          orderNumber: `RET - ${returnNumber} `,
          customerId: original.customerId,
          warehouseId: original.warehouseId,
          status: "RETURNED",
          type: "RETURN",
          items: {
            create: dto.items.map((ri) => {
              const origItem = original.items.find(
                (i) => i.id === ri.orderItemId,
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
              return {
                productId: origItem.productId,
                quantity: ri.returnQty,
                unit: origItem.unit,
                price: origItem.price,
                totalAmount: origItem.price * ri.returnQty,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const ri of dto.items) {
        const origItem = original.items.find((i) => i.id === ri.orderItemId);
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
