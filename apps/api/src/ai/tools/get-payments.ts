import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

export const createGetPaymentsTool = (orgId: string, prisma: PrismaService) => {
    return new DynamicStructuredTool({
        name: "get_payments",
        description: "Get outstanding payments, overdue invoices, and customer payment history or collection plans.",
        schema: z.object({
            type: z.enum(['outstanding', 'overdue', 'history', 'collection_plan']),
            customerId: z.string().optional(),
            limit: z.number().optional().default(10),
        }),
        func: (async ({ type, customerId, limit }: any) => {
            let whereClause: any = { orgId };
            if (customerId) whereClause.customerId = customerId;

            if (type === 'overdue' || type === 'outstanding') {
                whereClause.status = { in: ['SENT', 'PARTIAL', 'OVERDUE'] };
                if (type === 'overdue') {
                    whereClause.dueDate = { lt: new Date() };
                }

                const invoices = await prisma.invoice.findMany({
                    where: whereClause,
                    include: { customer: { select: { name: true, phone: true } } },
                    orderBy: { dueDate: 'asc' },
                    take: limit,
                });

                // Calculate days overdue
                const now = new Date();
                return JSON.stringify(invoices.map(inv => ({
                    invoiceNumber: inv.invoiceNumber,
                    customerName: inv.customer.name,
                    phone: inv.customer.phone,
                    dueDate: inv.dueDate.toISOString().split('T')[0],
                    daysOverdue: Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 3600 * 24))),
                    balanceAmount: inv.balanceAmount,
                })));
            }

            if (type === 'history') {
                if (!customerId) return "You must provide a customerId to view history.";
                const payments = await prisma.payment.findMany({
                    where: { orgId, customerId },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                });
                return JSON.stringify(payments);
            }

            if (type === 'collection_plan') {
                // Find top overdue customers
                const overdue = await prisma.invoice.groupBy({
                    by: ['customerId'],
                    where: { orgId, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, dueDate: { lt: new Date() } },
                    _sum: { balanceAmount: true },
                    orderBy: { _sum: { balanceAmount: 'desc' } },
                    take: limit,
                });

                const customerIds = overdue.map(o => o.customerId);
                const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
                const custMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

                return JSON.stringify(overdue.map(o => ({
                    customerName: custMap[o.customerId] || 'Unknown',
                    totalOverdue: o._sum.balanceAmount,
                    action: "Recommend calling or sending WhatsApp reminder"
                })));
            }

            return "Invalid type provided.";
        }) as any,
    });
};
