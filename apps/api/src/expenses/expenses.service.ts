import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

@Injectable()
export class ExpensesService {
    private readonly logger = new Logger(ExpensesService.name);
    private openai: OpenAI | null = null;

    constructor(private prisma: PrismaService) {
        if (process.env.OPENROUTER_API_KEY) {
            this.openai = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: process.env.OPENROUTER_API_KEY,
            });
        }
    }

    async findAll(orgId: string, query: { status?: string, category?: string, type?: string, page: number, limit: number }) {
        const { status, category, type, page, limit } = query;
        const skip = (page - 1) * limit;

        const where: any = { orgId };
        if (status) where.status = status;
        if (category) where.category = category;
        if (type && (type === 'OPERATIONAL' || type === 'PURCHASE')) where.type = type;

        const [items, total] = await Promise.all([
            this.prisma.expense.findMany({
                where, skip, take: limit, orderBy: { date: 'desc' },
                include: { purchaseOrder: { select: { id: true, poNumber: true } } },
            }),
            this.prisma.expense.count({ where }),
        ]);

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    async create(orgId: string, data: any) {
        // Validate PO ownership if linking to a purchase order
        if (data.purchaseOrderId) {
            const po = await this.prisma.purchaseOrder.findFirst({
                where: { id: data.purchaseOrderId, orgId },
            });
            if (!po) {
                throw new NotFoundException('Purchase order not found or does not belong to your organization');
            }
        }

        return this.prisma.expense.create({
            data: {
                orgId,
                type: data.type === 'PURCHASE' ? 'PURCHASE' : 'OPERATIONAL',
                vendorName: data.vendorName,
                amount: Number(data.amount),
                taxAmount: data.taxAmount ? Number(data.taxAmount) : null,
                date: new Date(data.date),
                category: data.category || null,
                paymentMethod: data.paymentMethod || null,
                purchaseOrderId: data.purchaseOrderId || null,
                receiptUrl: data.receiptUrl || null,
                notes: data.notes || null,
            },
            include: { purchaseOrder: { select: { id: true, poNumber: true } } },
        });
    }

    async updateStatus(orgId: string, id: string, status: string) {
        const expense = await this.prisma.expense.findFirst({ where: { id, orgId } });
        if (!expense) throw new NotFoundException('Expense not found');

        return this.prisma.expense.update({
            where: { id },
            data: { status }
        });
    }

    async remove(orgId: string, id: string) {
        const expense = await this.prisma.expense.findFirst({ where: { id, orgId } });
        if (!expense) throw new NotFoundException('Expense not found');

        return this.prisma.expense.delete({ where: { id } });
    }

    async scanReceipt(orgId: string, file: any) {
        if (!this.openai) {
            throw new BadRequestException('OpenRouter (AI) API key not configured');
        }

        if (!file.mimetype.startsWith('image/')) {
            throw new BadRequestException('Only image files are supported for receipt scanning');
        }

        try {
            const base64Image = file.buffer.toString('base64');
            const dataUrl = `data:${file.mimetype};base64,${base64Image}`;

            const response = await this.openai.chat.completions.create({
                model: 'google/gemini-2.5-flash',
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Extract the following details from this receipt/invoice. Return ONLY a pure JSON object (no markdown formatting, no comments) with these exact keys:
- "vendorName" (string)
- "amount" (number, the final total amount)
- "taxAmount" (number, total tax if visible, else 0)
- "date" (string, ISO format YYYY-MM-DD, try to guess the year if missing based on current context)
- "category" (string, pick one closest match: TRAVEL, FOOD, FUEL, UTILITIES, SUPPLIES, MAINTENANCE, SOFTWARE, SALARY, WAGES, RENT, FREIGHT, LOADING, VEHICLE, COMMISSION, PACKAGING, INSURANCE, INTEREST, WASTAGE, OTHER)

If you cannot read a value confidently, leave it null (except category, default to OTHER).`
                            },
                            {
                                type: 'image_url',
                                image_url: { url: dataUrl }
                            }
                        ]
                    }
                ],
                temperature: 0,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('AI returned empty response');
            }

            // The model is instructed to return json_object, so parsing should be safe
            const parsed = JSON.parse(content);
            this.logger.log(`Parsed receipt for org ${orgId}: ${JSON.stringify(parsed)}`);

            return {
                vendorName: parsed.vendorName || '',
                amount: parsed.amount || 0,
                taxAmount: parsed.taxAmount || 0,
                date: parsed.date || new Date().toISOString().split('T')[0],
                category: parsed.category || 'OTHER',
            };

        } catch (error: any) {
            this.logger.error('Failed to scan receipt', error?.message || error);
            throw new InternalServerErrorException('Failed to extract data from receipt. The image might be too blurry or unsupported.');
        }
    }
}
