import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Tool: update_payment
 * Lets the AI record an incoming payment against a customer's oldest unpaid invoice
 */
export const createUpdatePaymentTool = (orgId: string, userId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "update_payment",
        description: `Record a payment received from a customer. Use this when the user says things like "Record ₹5000 payment from Sharma" or "Cash payment of 2000 from Ramesh Kirana". This allocates the payment to the customer's oldest unpaid/overdue invoice.`,
        schema: z.object({
            customerName: z.string().describe("Customer name or partial name"),
            amount: z.number().describe("Payment amount in INR"),
            paymentMode: z.enum(['CASH', 'UPI', 'NEFT', 'CHEQUE', 'OTHER']).default('CASH').describe("Payment mode"),
            notes: z.string().optional().describe("Optional payment notes or reference number"),
        }),
        func: (async ({ customerName, amount, paymentMode, notes }: any) => {
            // Find customer
            const customer = await prisma.customer.findFirst({
                where: { orgId, name: { contains: customerName, mode: 'insensitive' } },
            });

            if (!customer) {
                return JSON.stringify({ error: `Customer "${customerName}" not found.` });
            }

            // Find oldest unpaid invoice
            const invoice = await prisma.invoice.findFirst({
                where: {
                    orgId,
                    customerId: customer.id,
                    status: { in: ['SENT', 'OVERDUE'] },
                    balanceAmount: { gt: 0 },
                },
                orderBy: { createdAt: 'asc' },
            });

            if (!invoice) {
                return JSON.stringify({
                    error: `No unpaid invoices found for ${customer.name}. All invoices are already paid.`,
                    customerName: customer.name,
                });
            }

            const paymentAmount = Math.min(amount, invoice.balanceAmount);
            const newBalance = invoice.balanceAmount - paymentAmount;
            const isFullyPaid = newBalance <= 0;

            // Create payment record
            const payment = await prisma.payment.create({
                data: {
                    orgId,
                    invoiceId: invoice.id,
                    customerId: customer.id,
                    amount: paymentAmount,
                    method: paymentMode || 'CASH',
                    notes: notes || `Recorded via AI Assistant`,
                    status: 'COMPLETED',
                },
            });

            // Update invoice balance
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    balanceAmount: newBalance,
                    status: isFullyPaid ? 'PAID' : invoice.status,
                },
            });

            const result: any = {
                success: true,
                paymentId: payment.id,
                customerName: customer.name,
                amountPaid: paymentAmount,
                invoiceNumber: invoice.invoiceNumber,
                previousBalance: invoice.balanceAmount,
                newBalance,
                invoiceStatus: isFullyPaid ? 'PAID' : invoice.status,
                message: `₹${paymentAmount.toLocaleString('en-IN')} payment recorded for ${customer.name} against invoice ${invoice.invoiceNumber}. ${isFullyPaid ? 'Invoice is now FULLY PAID! 🎉' : `Remaining balance: ₹${newBalance.toLocaleString('en-IN')}`}`,
            };

            // If user paid more than this invoice, note the surplus
            if (amount > invoice.balanceAmount) {
                result.surplusAmount = amount - invoice.balanceAmount;
                result.message += ` Note: ₹${result.surplusAmount.toLocaleString('en-IN')} surplus was not applied. Apply it to the next invoice separately.`;
            }

            return JSON.stringify(result);
        }) as any,
    });
};

/**
 * Tool: get_customer_balance
 * Lets the AI answer "What is Ramesh's remaining balance?"
 */
export const createGetCustomerBalanceTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_customer_balance",
        description: `Get outstanding balance and payment summary for a customer. Use this when the user asks "How much does Sharma owe?", "Remaining balance of Ramesh Kirana", or "Payment status for a customer".`,
        schema: z.object({
            customerName: z.string().describe("Customer name or partial name to look up"),
        }),
        func: (async ({ customerName }: { customerName: string }) => {
            const customer = await prisma.customer.findFirst({
                where: { orgId, name: { contains: customerName, mode: 'insensitive' } },
            });

            if (!customer) {
                return JSON.stringify({ error: `Customer "${customerName}" not found.` });
            }

            // Get all unpaid invoices
            const unpaidInvoices = await prisma.invoice.findMany({
                where: {
                    orgId,
                    customerId: customer.id,
                    status: { in: ['SENT', 'OVERDUE'] },
                    balanceAmount: { gt: 0 },
                },
                orderBy: { dueDate: 'asc' },
                select: {
                    invoiceNumber: true,
                    totalAmount: true,
                    balanceAmount: true,
                    status: true,
                    dueDate: true,
                    createdAt: true,
                },
            });

            // Get total payments received
            const totalPayments = await prisma.payment.aggregate({
                where: { orgId, customerId: customer.id, status: 'COMPLETED' },
                _sum: { amount: true },
                _count: { id: true },
            });

            // Get total invoiced
            const totalInvoiced = await prisma.invoice.aggregate({
                where: { orgId, customerId: customer.id },
                _sum: { totalAmount: true },
                _count: { id: true },
            });

            const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
            const overdueInvoices = unpaidInvoices.filter(i => i.status === 'OVERDUE');
            const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

            return JSON.stringify({
                customerName: customer.name,
                customerId: customer.id,
                creditLimit: customer.creditLimit,
                creditDays: customer.creditDays,
                totalInvoiced: totalInvoiced._sum.totalAmount ?? 0,
                totalPaid: totalPayments._sum.amount ?? 0,
                totalOutstanding,
                overdueAmount,
                overdueCount: overdueInvoices.length,
                unpaidInvoiceCount: unpaidInvoices.length,
                unpaidInvoices: unpaidInvoices.slice(0, 10).map(inv => ({
                    invoiceNumber: inv.invoiceNumber,
                    total: inv.totalAmount,
                    balance: inv.balanceAmount,
                    status: inv.status,
                    dueDate: inv.dueDate?.toISOString().split('T')[0] || 'N/A',
                })),
            });
        }) as any,
    });
};
