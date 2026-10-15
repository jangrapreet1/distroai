import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsEmail, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SupplierStatementPdfService } from './supplier-statement-pdf.service';
import { SupplierStatementQueryDto } from './dto/supplier-statement-query.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import type { SupplierStatementData, SupplierStatementRowData } from './supplier-statement.document';

export class CreateSupplierDto {
    @IsString() name!: string;
    @IsOptional() @IsString() contactPerson?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() gstNumber?: string;
    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsNumber() @Min(0) creditDays?: number;
    @IsOptional() @IsNumber() @Min(0) leadTimeDays?: number;
    @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class SuppliersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly pdfService: SupplierStatementPdfService,
    ) { }

    async findAll(orgId: string, page = 1, limit = 20) {
        const [data, total] = await Promise.all([
            this.prisma.supplier.findMany({ where: { orgId, isActive: true }, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
            this.prisma.supplier.count({ where: { orgId, isActive: true } }),
        ]);
        return { data, meta: { total, page, limit } };
    }

    async create(orgId: string, dto: CreateSupplierDto) {
        return this.prisma.supplier.create({ data: { orgId, ...dto } });
    }

    async findOne(orgId: string, id: string) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id, orgId } });
        if (!supplier) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier not found' });
        const recentPOs = await this.prisma.purchaseOrder.findMany({ where: { supplierId: id }, take: 10, orderBy: { createdAt: 'desc' } });
        return { supplier, recentPOs };
    }

    async update(orgId: string, id: string, dto: Partial<CreateSupplierDto>) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id, orgId } });
        if (!supplier) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier not found' });
        return this.prisma.supplier.update({ where: { id }, data: dto });
    }

    /**
     * Compiles structured 8-column Supplier Account Summary data
     * (DATE, Items Received, Quantity, Cost of 1, Worth items received, RETURNED, Amount Paid, Balance)
     */
    async getStatementData(orgId: string, supplierId: string, query?: SupplierStatementQueryDto): Promise<SupplierStatementData> {
        const [org, supplier] = await Promise.all([
            this.prisma.organization.findUnique({
                where: { id: orgId },
                select: { name: true, address: true, city: true, state: true, phone: true, gstNumber: true },
            }),
            this.prisma.supplier.findFirst({
                where: { id: supplierId, orgId },
                select: { id: true, name: true, phone: true, city: true, address: true, gstNumber: true },
            }),
        ]);

        if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });
        if (!supplier) throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });

        const startDate = query?.startDate ? new Date(query.startDate) : undefined;
        const endDate = query?.endDate ? new Date(query.endDate + 'T23:59:59.999Z') : undefined;

        // Fetch Purchase Orders with items and products
        const poWhere: any = { orgId, supplierId };
        if (startDate || endDate) {
            poWhere.createdAt = {};
            if (startDate) poWhere.createdAt.gte = startDate;
            if (endDate) poWhere.createdAt.lte = endDate;
        }

        const purchaseOrders = await this.prisma.purchaseOrder.findMany({
            where: poWhere,
            include: {
                items: {
                    include: {
                        product: { select: { name: true, sku: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Fetch Payments / Expenses made to this supplier
        const poIds = purchaseOrders.map((p) => p.id);
        const expenseWhere: any = {
            orgId,
            OR: [
                { vendorName: { equals: supplier.name, mode: 'insensitive' } },
                { purchaseOrderId: { in: poIds } },
            ],
        };
        if (startDate || endDate) {
            expenseWhere.date = {};
            if (startDate) expenseWhere.date.gte = startDate;
            if (endDate) expenseWhere.date.lte = endDate;
        }

        const expenses = await this.prisma.expense.findMany({
            where: expenseWhere,
            include: { purchaseOrder: { select: { poNumber: true } } },
            orderBy: { date: 'asc' },
        });

        // Transform PO items into rows
        const rawEntries: Array<SupplierStatementRowData & { rawDate: Date }> = [];

        for (const po of purchaseOrders) {
            const poDate = po.receivedDate || po.createdAt;
            const dateStr = poDate.toISOString().slice(0, 10);

            for (const item of po.items) {
                const qty = item.receivedQty > 0 ? item.receivedQty : item.orderedQty;
                const cost = item.price || 0;
                const worth = qty * cost;

                rawEntries.push({
                    date: dateStr,
                    itemName: `${item.product?.name || 'Item'} (${po.poNumber})`,
                    quantity: qty,
                    cost: cost,
                    worth: worth,
                    returned: null,
                    amountPaid: null,
                    poNumber: po.poNumber,
                    type: 'PURCHASE_ITEM',
                    rawDate: poDate,
                });
            }
        }

        // Transform Expenses (Payments made) into rows
        for (const exp of expenses) {
            const dateStr = exp.date.toISOString().slice(0, 10);
            const methodLabel = exp.paymentMethod ? ` [${exp.paymentMethod}]` : '';
            const poRef = exp.purchaseOrder?.poNumber ? ` (${exp.purchaseOrder.poNumber})` : '';

            rawEntries.push({
                date: dateStr,
                itemName: `Payment Made${methodLabel}${poRef}${exp.notes ? ` — ${exp.notes}` : ''}`,
                quantity: null,
                cost: null,
                worth: null,
                returned: null,
                amountPaid: exp.amount,
                poNumber: exp.purchaseOrder?.poNumber || undefined,
                type: 'PAYMENT',
                rawDate: exp.date,
            });
        }

        // Sort chronologically
        rawEntries.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

        // Calculate running balance and aggregates
        let runningBalance = 0;
        let totalWorth = 0;
        let totalReturned = 0;
        let totalPaid = 0;

        const rows: SupplierStatementRowData[] = rawEntries.map((entry) => {
            const itemWorth = entry.worth || 0;
            const itemReturned = entry.returned || 0;
            const itemPaid = entry.amountPaid || 0;

            totalWorth += itemWorth;
            totalReturned += itemReturned;
            totalPaid += itemPaid;

            runningBalance = runningBalance + itemWorth - itemReturned - itemPaid;

            const { rawDate, ...cleanRow } = entry;
            return {
                ...cleanRow,
                balance: Math.round(runningBalance * 100) / 100,
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
            supplier: {
                id: supplier.id,
                name: supplier.name,
                phone: supplier.phone,
                city: supplier.city,
                address: supplier.address,
                gstNumber: supplier.gstNumber,
            },
            statementDate: query?.statementDate || new Date().toISOString().slice(0, 10),
            rows,
            summary: {
                totalWorth: Math.round(totalWorth * 100) / 100,
                totalReturned: Math.round(totalReturned * 100) / 100,
                totalPaid: Math.round(totalPaid * 100) / 100,
                balance: Math.round(runningBalance * 100) / 100,
                totalItemsCount: rows.filter((r) => r.type === 'PURCHASE_ITEM').length,
            },
        };
    }

    /**
     * Record a payment made to a supplier (stored as an operational expense)
     */
    async recordPayment(orgId: string, supplierId: string, dto: RecordSupplierPaymentDto, userId: string) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, orgId } });
        if (!supplier) throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });

        const expense = await this.prisma.expense.create({
            data: {
                orgId,
                type: 'OPERATIONAL',
                category: 'Supplier Payment',
                vendorName: supplier.name,
                amount: dto.amount,
                date: dto.date ? new Date(dto.date) : new Date(),
                paymentMethod: (dto.paymentMethod as any) || 'CASH',
                notes: dto.notes,
                purchaseOrderId: dto.purchaseOrderId || undefined,
                status: 'PAID',
            },
        });

        return { success: true, expense };
    }

    /**
     * Stream binary PDF of the 8-column Supplier Account Summary
     */
    async generateStatementPdf(orgId: string, supplierId: string, query?: SupplierStatementQueryDto): Promise<Buffer> {
        const statement = await this.getStatementData(orgId, supplierId, query);
        return this.pdfService.generatePdf(statement);
    }
}
