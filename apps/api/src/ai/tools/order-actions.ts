import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Tool: create_order
 * Lets the AI autonomously create a new sales order from natural language
 */
export const createCreateOrderTool = (orgId: string, userId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "create_order",
        description: `Create a new sales order for a customer. Use this when the user says things like "Create an order for Sharma Kirana" or "Order 10 boxes of Parle-G for Ramesh". You MUST first search for the customer and products, then call this tool with the resolved IDs. The order will be created as CONFIRMED.`,
        schema: z.object({
            customerName: z.string().describe("Customer name or partial name to search for"),
            items: z.array(z.object({
                productName: z.string().describe("Product name or SKU"),
                quantity: z.number().describe("Quantity to order"),
            })).describe("List of products and quantities to order"),
            notes: z.string().optional().describe("Optional notes for the order"),
        }),
        func: (async ({ customerName, items, notes }: any) => {
            // Find customer
            const customer = await prisma.customer.findFirst({
                where: { orgId, name: { contains: customerName, mode: 'insensitive' } },
            });

            if (!customer) {
                return JSON.stringify({ error: `Customer "${customerName}" not found. Please check the name and try again.` });
            }

            // Find warehouse
            const warehouse = await prisma.warehouse.findFirst({
                where: { orgId, isDefault: true },
            }) || await prisma.warehouse.findFirst({ where: { orgId } });

            if (!warehouse) {
                return JSON.stringify({ error: "No warehouse found. Please create a warehouse first." });
            }

            // Resolve products
            const resolvedItems: any[] = [];
            for (const item of items) {
                const product = await prisma.product.findFirst({
                    where: {
                        orgId,
                        OR: [
                            { name: { contains: item.productName, mode: 'insensitive' } },
                            { sku: { equals: item.productName, mode: 'insensitive' } },
                        ]
                    },
                });

                if (!product) {
                    return JSON.stringify({ error: `Product "${item.productName}" not found. Please check the name.` });
                }

                const lineTotal = product.sellingPrice * item.quantity;
                const taxAmount = lineTotal * (product.gstRate / 100);

                resolvedItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    unit: product.unit || 'PCS',
                    price: product.sellingPrice,
                    discount: 0,
                    taxRate: product.gstRate,
                    taxAmount,
                    totalAmount: lineTotal + taxAmount,
                    productName: product.name,
                });
            }

            // Generate order number
            const count = await prisma.order.count({ where: { orgId } });
            const settings = await prisma.orgSettings.findUnique({ where: { orgId } });
            const prefix = settings?.orderPrefix ?? 'ORD';
            const orderNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;

            // Calculate totals
            const totalAmount = resolvedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            const taxAmount = resolvedItems.reduce((sum, i) => sum + i.taxAmount, 0);
            const netAmount = totalAmount + taxAmount;

            // Create order
            const order = await prisma.order.create({
                data: {
                    orgId,
                    orderNumber,
                    customerId: customer.id,
                    warehouseId: warehouse.id,
                    source: 'APP',
                    notes: notes || `Created by AI Assistant`,
                    totalAmount,
                    discountAmount: 0,
                    taxAmount,
                    netAmount,
                    balanceAmount: netAmount,
                    status: 'CONFIRMED',
                    items: {
                        create: resolvedItems.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            unit: i.unit,
                            price: i.price,
                            discount: 0,
                            taxRate: i.taxRate,
                            taxAmount: i.taxAmount,
                            totalAmount: i.totalAmount,
                        })),
                    },
                    statusHistory: { create: { toStatus: 'CONFIRMED', changedBy: userId } },
                },
                include: { items: true },
            });

            return JSON.stringify({
                success: true,
                orderNumber: order.orderNumber,
                customerName: customer.name,
                itemCount: order.items.length,
                totalAmount: order.totalAmount,
                taxAmount: order.taxAmount,
                netAmount: order.netAmount,
                items: resolvedItems.map(i => ({ product: i.productName, qty: i.quantity, price: i.price })),
                message: `Order ${order.orderNumber} created successfully for ${customer.name} with ${order.items.length} item(s). Total: ₹${order.netAmount.toLocaleString('en-IN')}`,
            });
        }) as any,
    });
};

/**
 * Tool: cancel_order
 * Lets the AI cancel an existing order
 */
export const createCancelOrderTool = (orgId: string, userId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "cancel_order",
        description: `Cancel an existing order by its order number. Use this when the user says "Cancel order ORD-00045" or "Cancel the last order for Sharma". Only DRAFT and CONFIRMED orders can be cancelled.`,
        schema: z.object({
            orderNumber: z.string().optional().describe("The order number like ORD-00045"),
            customerName: z.string().optional().describe("Customer name to find their latest cancellable order"),
        }),
        func: (async ({ orderNumber, customerName }: any) => {
            let order: any = null;

            if (orderNumber) {
                order = await prisma.order.findFirst({
                    where: { orgId, orderNumber: { contains: orderNumber, mode: 'insensitive' } },
                    include: { customer: { select: { name: true } } },
                });
            } else if (customerName) {
                const customer = await prisma.customer.findFirst({
                    where: { orgId, name: { contains: customerName, mode: 'insensitive' } },
                });
                if (!customer) {
                    return JSON.stringify({ error: `Customer "${customerName}" not found.` });
                }
                order = await prisma.order.findFirst({
                    where: { orgId, customerId: customer.id, status: { in: ['DRAFT', 'CONFIRMED'] } },
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { name: true } } },
                });
            }

            if (!order) {
                return JSON.stringify({ error: "No cancellable order found. Only DRAFT or CONFIRMED orders can be cancelled." });
            }

            if (!['DRAFT', 'CONFIRMED'].includes(order.status)) {
                return JSON.stringify({ error: `Order ${order.orderNumber} has status "${order.status}" and cannot be cancelled. Only DRAFT or CONFIRMED orders are cancellable.` });
            }

            await prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'CANCELLED',
                    statusHistory: { create: { fromStatus: order.status, toStatus: 'CANCELLED', changedBy: userId } },
                },
            });

            return JSON.stringify({
                success: true,
                orderNumber: order.orderNumber,
                customerName: order.customer.name,
                previousStatus: order.status,
                message: `Order ${order.orderNumber} for ${order.customer.name} has been cancelled.`,
            });
        }) as any,
    });
};
