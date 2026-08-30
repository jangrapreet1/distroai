import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import axios from 'axios';
import { EventsService } from '../events/events.service';

@Processor('ai', { concurrency: 2 })
export class AiProcessor extends WorkerHost {
    private readonly logger = new Logger(AiProcessor.name);
    private openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => WhatsAppService)) private whatsappService: WhatsAppService,
        private eventsService: EventsService,
    ) {
        super();
    }

    async process(job: Job<any>): Promise<any> {
        this.logger.log(`Processing AI job ${job.name} (ID: ${job.id})`);

        switch (job.name) {
            case 'generate-briefing':
                return this.handleGenerateBriefing(job.data.orgId);
            case 'process-embedding':
                return this.handleProcessEmbedding(job.data.productId);
            case 'run-forecast':
                return this.handleForecast(job.data.orgId, job.data.productId);
            case 'compute-payment-scores':
                return this.handlePaymentScores(job.data.orgId);
            default:
                this.logger.warn(`Unknown AI job name: ${job.name}`);
        }
    }

    private async fetchBriefingData(orgId: string) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sales = await this.prisma.order.aggregate({
            where: { orgId, createdAt: { gte: yesterday, lt: today }, status: { in: ['DELIVERED', 'DISPATCHED'] } },
            _sum: { netAmount: true },
            _count: { id: true },
        });

        const lowStock = await this.prisma.inventory.count({
            where: { orgId, quantity: { lte: 10 } } // simplified for now
        });

        const collections = await this.prisma.payment.aggregate({
            where: { orgId, createdAt: { gte: yesterday, lt: today } },
            _sum: { amount: true },
        });

        return {
            yesterdaysSales: sales._sum.netAmount || 0,
            ordersShipped: sales._count.id || 0,
            collections: collections._sum.amount || 0,
            lowStockItems: lowStock,
        };
    }

    private async handleGenerateBriefing(orgId: string) {
        const data = await this.fetchBriefingData(orgId);
        let briefingText = '';

        if (this.openaiClient) {
            const prompt = `You are DistroAI. Write a concise WhatsApp morning briefing message for a distributor.
Use the data below. Write in a friendly, professional tone. Use emojis sparingly.
Include: yesterday summary, today's alerts, top priorities.
Keep it under 400 words. Format for WhatsApp (no markdown headers, use bullet points with •).
Data: ${JSON.stringify(data)}`;

            const completion = await this.openaiClient.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
            });
            briefingText = completion.choices[0].message.content || 'Briefing error';
        } else {
            briefingText = `📊 *Morning Briefing*\n\nYesterday's Sales: ₹${data.yesterdaysSales}\nOrders: ${data.ordersShipped}\nCollections: ₹${data.collections}\nLow Stock Items: ${data.lowStockItems}\n\nHave a great day!`;
        }

        // Send to owners and admins via WhatsApp
        const recipients = await this.prisma.user.findMany({
            where: { orgId, role: { in: ['OWNER', 'ADMIN'] }, phone: { not: null } }
        });

        for (const user of recipients) {
            await this.whatsappService.sendText(orgId, user.phone!, briefingText);
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`AI Job ${job.id} failed: ${error.message}`, error.stack);
    }

    private async handleProcessEmbedding(productId: string) {
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) return;

        try {
            if (!process.env.OPENROUTER_API_KEY) {
                // Failsafe if env var missing; marks FAILED to release PENDING lock.
                await this.prisma.product.update({ where: { id: productId }, data: { embeddingStatus: 'FAILED' } });
                return;
            }

            const { GoogleGenerativeAIEmbeddings } = await import('@langchain/google-genai');
            const embeddings = new GoogleGenerativeAIEmbeddings({
                apiKey: process.env.OPENROUTER_API_KEY,
                model: "text-embedding-004",
            });

            // Feed vital stats to the RAG vector map
            const textToEmbed = `Product Name: ${product.name}
SKU: ${product.sku}
Brand: ${product.brand || 'N/A'}
Category: ${product.category || 'N/A'}
Description: ${product.description || 'No description'}`;

            const vector = await embeddings.embedQuery(textToEmbed);

            await this.prisma.$executeRawUnsafe(
                `UPDATE "Product" SET embedding = $1::vector, "embeddingStatus" = 'COMPLETED' WHERE id = $2`,
                `[${vector.join(',')}]`,
                productId
            );

            this.logger.log(`Successfully embedded product ${productId}`);
        } catch (error: any) {
            this.logger.error(`Failed to embed product ${productId}`, error);
            // Mark as FAILED so fallback ILIKE logic knows it's offline
            await this.prisma.product.update({
                where: { id: productId },
                data: { embeddingStatus: 'FAILED' },
            });
            throw error; // Let BullMQ capture the retry parameters
        }
    }

    private async handleForecast(orgId: string, productId: string) {
        try {
            const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
            const response = await axios.post(`${aiServiceUrl}/forecast/run`, {
                org_id: orgId,
                product_id: productId,
                horizon_days: 30,
            });

            // Save forecast results to DemandForecast table
            if (response.data?.dates?.length > 0) {
                // Delete old forecast for this product
                await this.prisma.demandForecast.deleteMany({
                    where: { orgId, productId }
                });

                await this.prisma.demandForecast.createMany({
                    data: response.data.dates.map((date: string, i: number) => ({
                        orgId,
                        productId,
                        forecastDate: new Date(date),
                        predictedQty: response.data.predicted[i],
                        lowerBound: response.data.lower[i],
                        upperBound: response.data.upper[i],
                        confidence: response.data.confidence,
                        modelVersion: response.data.model_used,
                    })),
                });
                this.logger.log(`Successfully ran forecast for product ${productId}`);

                // Feature: Smart Reorder & Auto-PO
                if (response.data.reorder_qty && response.data.reorder_qty > 0) {
                    const product = await this.prisma.product.findUnique({
                        where: { id: productId },
                    });

                    if (product && (product as any).supplierId) {
                        const supplierId = (product as any).supplierId;

                        // Check if pending PO exists
                        const existingPo = await this.prisma.purchaseOrder.findFirst({
                            where: {
                                orgId,
                                supplierId,
                                status: { in: ['DRAFT', 'SENT', 'ACKNOWLEDGED'] },
                                items: { some: { productId } }
                            }
                        });

                        if (!existingPo) {
                            // Find default warehouse
                            const wh = await this.prisma.warehouse.findFirst({ where: { orgId, isDefault: true }});
                            if (wh) {
                                // Generate PO number based on count
                                const count = await this.prisma.purchaseOrder.count({ where: { orgId } });
                                const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
                                const qty = Math.ceil(response.data.reorder_qty);
                                const total = qty * Number(product.purchasePrice || 0);

                                await this.prisma.purchaseOrder.create({
                                    data: {
                                        orgId,
                                        supplierId,
                                        poNumber,
                                        status: 'DRAFT',
                                        totalAmount: total,
                                        items: {
                                            create: [{
                                                productId,
                                                orderedQty: qty,
                                                price: Number(product.purchasePrice || 0),
                                                totalAmount: total,
                                            }]
                                        }
                                    }
                                });

                                this.eventsService.emit(orgId, 'notification:created', { 
                                    message: `Auto-PO Drafted for ${product.name} (Qty: ${qty})` 
                                });
                                this.logger.log(`Auto-PO drafted for product ${productId}`);
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            this.logger.error(`Failed to run forecast for product ${productId}`, error);
            throw error;
        }
    }

    private async handlePaymentScores(orgId: string) {
        try {
            const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
            const customers = await this.prisma.customer.findMany({
                where: { orgId },
                select: { id: true },
            });

            let successCount = 0;
            for (const customer of customers) {
                try {
                    const response = await axios.post(`${aiServiceUrl}/score/payment`, {
                        customer_id: customer.id,
                        org_id: orgId,
                    });

                    if (response.data && typeof response.data.score === 'number') {
                        await this.prisma.customer.update({
                            where: { id: customer.id },
                            data: { paymentScore: response.data.score },
                        });
                        successCount++;
                    }
                } catch (e) {
                    this.logger.warn(`Failed to score customer ${customer.id}`);
                }
            }
            this.logger.log(`Successfully updated payment scores for ${successCount}/${customers.length} customers`);
        } catch (error: any) {
            this.logger.error(`Failed to compute payment scores for org ${orgId}`, error);
            throw error;
        }
    }
}
