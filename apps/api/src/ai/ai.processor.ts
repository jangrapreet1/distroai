import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Processor('ai', { concurrency: 2 })
export class AiProcessor extends WorkerHost {
    private readonly logger = new Logger(AiProcessor.name);
    private openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => WhatsAppService)) private whatsappService: WhatsAppService
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
            // Other AI jobs like run-forecast, compute-payment-scores are handled by Python microservice or separate crons
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

        // Send to owners via WhatsApp
        const owners = await this.prisma.user.findMany({
            where: { orgId, role: 'OWNER', phone: { not: null } }
        });

        for (const owner of owners) {
            await this.whatsappService.sendText(orgId, owner.phone!, briefingText);
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
}
