import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { Queue } from "bullmq";
import { v4 as uuid } from 'uuid';

export const createOrderTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "confirm_and_create_order",
        description: `Creates a new DRAFT order in the system after the user explicitly confirms the order summary. Use this ONLY after the user has said "Confirm" to the <ask_input> order summary.`,
        schema: z.object({
            customerId: z.string().describe("The ID of the customer"),
            items: z.array(z.object({
                productId: z.string(),
                quantity: z.number()
            })).describe("The items to order"),
            notes: z.string().optional().describe("Optional order notes")
        }),
        func: async ({ customerId, items, notes }: any) => {
            // Validate plan (only available for non-FREE plans)
            const org = await prisma.organization.findUnique({ where: { id: orgId } });
            if (org?.plan === 'FREE') {
                return "Error: Action not allowed on FREE plan. Please upgrade.";
            }

            // Get product details to calculate prices
            const productIds = items.map((i: any) => i.productId);
            const products = await prisma.product.findMany({
                where: { orgId, id: { in: productIds } }
            });

            if (products.length !== items.length) {
                return "Error: Some products could not be found.";
            }

            const productMap = new Map(products.map(p => [p.id, p]));
            let totalAmount = 0;
            let netAmount = 0;

            const orderItems = items.map((item: any) => {
                const product = productMap.get(item.productId)!;
                const price = product.sellingPrice;
                const amount = price * item.quantity;
                totalAmount += amount;
                netAmount += amount; // Simplified for AI drafting

                return {
                    productId: product.id,
                    quantity: item.quantity,
                    price,
                    unit: product.unit || 'Pieces',
                    totalAmount: amount,
                    taxRate: product.gstRate || 0,
                    taxAmount: amount * ((product.gstRate || 0) / 100)
                };
            });

            const count = await prisma.order.count({ where: { orgId } });
            const orderNumber = `ORD-AI-${String(count + 1).padStart(5, '0')}`;
            
            // Just use the first warehouse for simplicity
            const warehouse = await prisma.warehouse.findFirst({ where: { orgId } });
            if (!warehouse) return "Error: No warehouse found for organization.";

            const order = await prisma.order.create({
                data: {
                    orgId,
                    orderNumber,
                    customerId,
                    warehouseId: warehouse.id,
                    status: 'DRAFT',
                    totalAmount,
                    netAmount,
                    balanceAmount: netAmount,
                    notes: notes || "Created via AI Assistant",
                    items: {
                        create: orderItems
                    }
                }
            });

            await prisma.auditLog.create({
                data: {
                    orgId,
                    userId: "system-ai",
                    action: "CREATE",
                    entityType: "Order",
                    entityId: order.id,
                    newValue: { status: 'DRAFT', source: 'AI' }
                }
            });

            return JSON.stringify({
                message: `Order ${orderNumber} created successfully as DRAFT.`,
                orderId: order.id,
                orderNumber,
                netAmount
            });
        }
    });
};

export const createPaymentTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "confirm_and_record_payment",
        description: `Records a payment collection after the user explicitly confirms the payment summary. Use this ONLY after the user has said "Confirm" to the <ask_input> payment summary.`,
        schema: z.object({
            customerId: z.string().describe("The ID of the customer who made the payment"),
            amount: z.number().describe("The amount received"),
            method: z.enum(['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER']).describe("The payment method used"),
            notes: z.string().optional().describe("Optional payment notes")
        }),
        func: async ({ customerId, amount, method, notes }: any) => {
            const org = await prisma.organization.findUnique({ where: { id: orgId } });
            if (org?.plan === 'FREE') {
                return "Error: Action not allowed on FREE plan. Please upgrade.";
            }

            // Create ledger entry
            const ledger = await prisma.ledgerEntry.create({
                data: {
                    orgId,
                    customerId,
                    type: 'CREDIT',
                    amount,
                    balance: 0,
                    notes: notes || `Payment received via ${method} (AI)`,
                    referenceType: 'PAYMENT',
                    referenceId: uuid(),
                }
            });

            // Update customer outstanding
            await prisma.customer.update({
                where: { id: customerId },
                data: {
                    outstandingAmount: {
                        decrement: amount
                    }
                }
            });

            await prisma.auditLog.create({
                data: {
                    orgId,
                    userId: "system-ai",
                    action: "CREATE",
                    entityType: "Payment",
                    entityId: ledger.id,
                    newValue: { amount, method, source: 'AI' }
                }
            });

            return JSON.stringify({
                message: `Payment of ₹${amount} recorded successfully.`,
                ledgerId: ledger.id
            });
        }
    });
};

export const createSendReminderTool = (orgId: string, aiQueue: Queue) => {
    return new DynamicStructuredTool({
        name: "confirm_and_send_reminder",
        description: `Queues a payment reminder to be sent via WhatsApp after the user explicitly confirms. Use this ONLY after the user has said "Confirm" to the <ask_input> reminder summary.`,
        schema: z.object({
            customerId: z.string().describe("The ID of the customer to remind"),
            tone: z.enum(['Gentle', 'Standard', 'Urgent']).describe("The tone of the reminder message")
        }),
        func: async ({ customerId, tone }: any) => {
            // Queue the reminder in BullMQ
            // Realistically, the queue processor handles sending it.
            await aiQueue.add('send-whatsapp-reminder', {
                orgId,
                customerId,
                tone,
                source: 'AI'
            });

            return JSON.stringify({
                message: `Reminder queued successfully to be sent with ${tone} tone.`
            });
        }
    });
};
