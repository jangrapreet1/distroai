import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Tool: get_ledger_history
 * Lets the AI fetch granular chronological ledger entries for a customer.
 */
export const createGetLedgerHistoryTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_ledger_history",
        description: `Fetch chronological financial ledger entries (Debits and Credits) for a customer. Use this to explain exactly why a customer owes a specific balance by stepping through past invoices and payments. Returns max 50 entries to conserve context.`,
        schema: z.object({
            customerName: z.string().describe("Customer name or partial name"),
            dateFrom: z.string().optional().describe("Optional start date in YYYY-MM-DD format"),
            dateTo: z.string().optional().describe("Optional end date in YYYY-MM-DD format"),
        }),
        func: (async ({ customerName, dateFrom, dateTo }: any) => {
            // Find customer strictly bounded to the requesting orgId
            const customer = await prisma.customer.findFirst({
                where: { orgId, name: { contains: customerName, mode: 'insensitive' } },
            });

            if (!customer) {
                return JSON.stringify({ error: `Customer "${customerName}" not found.` });
            }

            const whereClause: any = {
                orgId, // CRITICAL: Security Boundary
                customerId: customer.id,
            };

            if (dateFrom || dateTo) {
                whereClause.createdAt = {};
                if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
                if (dateTo) whereClause.createdAt.lte = new Date(`${dateTo}T23:59:59Z`);
            }

            const entries = await prisma.ledgerEntry.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' }, // Latest first
                take: 50, // CRITICAL: Pagination boundary
            });

            if (entries.length === 0) {
                return JSON.stringify({
                    message: "No ledger entries found for this customer in the given period.",
                    customerName: customer.name,
                    balance: customer.outstandingAmount
                });
            }

            // Return formatted entries sorted chronologically for the AI to read naturally
            return JSON.stringify({
                customerName: customer.name,
                currentBalance: customer.outstandingAmount,
                entries: entries.reverse().map(e => ({
                    date: e.createdAt.toISOString().split('T')[0],
                    type: e.type,
                    amount: e.amount,
                    runningBalance: e.balance,
                    reference: e.referenceType,
                    notes: e.notes || 'None'
                }))
            });
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
        description: `Get outstanding balance and payment summary for a customer.`,
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

            const unpaidInvoices = await prisma.invoice.findMany({
                where: {
                    orgId,
                    customerId: customer.id,
                    status: { in: ['SENT', 'OVERDUE'] },
                    balanceAmount: { gt: 0 },
                },
                orderBy: { dueDate: 'asc' },
                select: { invoiceNumber: true, totalAmount: true, balanceAmount: true, status: true, dueDate: true },
            });

            const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

            return JSON.stringify({
                customerName: customer.name,
                creditLimit: customer.creditLimit,
                totalOutstanding,
                unpaidInvoiceCount: unpaidInvoices.length,
                unpaidInvoices: unpaidInvoices.slice(0, 10).map((inv: any) => ({
                    invoiceNumber: inv.invoiceNumber,
                    balance: inv.balanceAmount,
                    status: inv.status,
                    dueDate: inv.dueDate?.toISOString().split('T')[0] || 'N/A',
                })),
            });
        }) as any,
    });
};
