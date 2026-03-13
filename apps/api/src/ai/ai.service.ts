import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service as StorageService } from '../storage/s3.service';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { detectLanguage } from './utils/language-detector';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createToolCallingAgent, AgentExecutor } = require('@langchain/langgraph/prebuilt') as any;
import { ChatPromptTemplate } from "@langchain/core/prompts";
import Redis from 'ioredis';

// Tools
import { createQuerySalesTool } from './tools/query-sales';
import { createGetInventoryTool } from './tools/get-inventory';
import { createGetPaymentsTool } from './tools/get-payments';
import { createGetForecastTool, createGetCustomerTool, createGetSalesmanTool } from './tools/get-forecast-customer-salesman';
import { createGetSuppliersTool, createRunReportTool } from './tools/get-suppliers-report';
import OpenAI from 'openai';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';

export const llm = process.env.OPENAI_API_KEY
    ? new ChatOpenAI({ model: 'gpt-4o', temperature: 0 })
    : process.env.ANTHROPIC_API_KEY
        ? new ChatAnthropic({ model: 'claude-3-5-sonnet-20241022', temperature: 0 })
        : null;

const PLAN_LIMITS = {
    FREE: { maxAiQueriesPerMonth: 0 },
    STARTER: { maxAiQueriesPerMonth: 100 },
    GROWTH: { maxAiQueriesPerMonth: 1000 },
    ENTERPRISE: { maxAiQueriesPerMonth: 10000 },
};

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private redis: Redis | null = null;

    private openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

    constructor(
        private prisma: PrismaService,
        private storageService: StorageService
    ) {
        if (process.env.REDIS_URL) {
            this.redis = new Redis(process.env.REDIS_URL);
        }
    }

    async checkAndIncrementAIUsage(orgId: string): Promise<void> {
        if (!this.redis) return;

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return;

        const currentMonth = new Date().toISOString().substring(0, 7);
        const key = `ai_usage:${orgId}:${currentMonth}`;

        const count = await this.redis.incr(key);
        if (count === 1) {
            await this.redis.expire(key, 32 * 24 * 60 * 60);
        }

        const planKey = org.plan as keyof typeof PLAN_LIMITS;
        const limit = PLAN_LIMITS[planKey]?.maxAiQueriesPerMonth || 0;

        if (count > limit) {
            throw new ForbiddenException({
                code: 'AI_QUOTA_EXCEEDED',
                message: `Monthly AI query limit (${limit}) reached. Upgrade to get more.`,
            });
        }
    }

    private buildTools(orgId: string) {
        return [
            createQuerySalesTool(orgId, this.prisma),
            createGetInventoryTool(orgId, this.prisma),
            createGetPaymentsTool(orgId, this.prisma),
            createGetForecastTool(orgId, this.prisma),
            createGetCustomerTool(orgId, this.prisma),
            createGetSalesmanTool(orgId, this.prisma),
            createGetSuppliersTool(orgId, this.prisma),
            createRunReportTool(orgId, this.prisma),
        ];
    }

    async query(orgId: string, userId: string, userQuery: string) {
        if (!llm) {
            return { response: "AI is not configured. Please add OPENAI_API_KEY to environment variables." };
        }

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        const orgName = org?.name || 'your organization';

        const detectedLang = detectLanguage(userQuery);

        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `You are DistroAI, an intelligent business assistant for ${orgName}, an Indian distribution business.
You have access to their complete business data through tools. Always use tools to get real data before answering.

Language: Respond in ${detectedLang === 'hi' ? 'Hindi (Devanagari script mixed with business terms in English)' : 'English'}.

Data format rules:
- All monetary values: Indian format with ₹ symbol
- Dates: DD MMM YYYY format
- Numbers: Indian system (1 lakh = 1,00,000; 1 crore = 1,00,00,000)

When you have data that would benefit from visualization, wrap it in XML tags:
- For charts: <chart type="bar|line|pie" title="...">JSON data array</chart>
- For tables: <table headers="col1,col2,...">JSON rows array</table>

Always be direct and actionable. End with a specific recommendation when relevant.
Never make up data. If a tool returns no data, say so clearly.
Current date: ${new Date().toISOString().split('T')[0]}`],
            ["placeholder", "{chat_history}"],
            ["user", "{input}"],
            ["placeholder", "{agent_scratchpad}"],
        ]);

        const tools = this.buildTools(orgId);
        const agent = createToolCallingAgent({ llm, tools, prompt });
        const agentExecutor = new AgentExecutor({ agent, tools });

        const timeoutMs = 30000;

        try {
            const result: any = await Promise.race([
                agentExecutor.invoke({ input: userQuery }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
            ]);

            await this.prisma.aIQuery.create({
                data: {
                    orgId,
                    userId,
                    query: userQuery,
                    response: result.output,
                    latencyMs: 1500, // mock latency tracking for now
                }
            });

            return { response: result.output };
        } catch (error: any) {
            if (error.message === 'timeout') {
                return { response: "I'm sorry, that query took too long to process. Try a simpler question." };
            }
            this.logger.error("AI Query Error", error);
            return { response: "There was an error processing your query. Please try again." };
        }
    }

    async * queryStream(orgId: string, userId: string, userQuery: string): AsyncIterable<{ data: string }> {
        if (!llm) {
            yield { data: JSON.stringify({ token: "AI is not configured. Please add OPENAI_API_KEY.", done: true }) };
            return;
        }

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        const orgName = org?.name || 'your organization';
        const detectedLang = detectLanguage(userQuery);

        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `You are DistroAI, an intelligent business assistant for ${orgName}, an Indian distribution business.
You have access to their complete business data through tools. Always use tools to get real data before answering.

Language: Respond in ${detectedLang === 'hi' ? 'Hindi (Devanagari script mixed with business terms in English)' : 'English'}.

Data format rules:
- All monetary values: Indian format with ₹ symbol
- Dates: DD MMM YYYY format
- Numbers: Indian system (1 lakh = 1,00,000)

When you have data that would benefit from visualization, wrap it in XML tags:
- For charts: <chart type="bar|line|pie" title="...">JSON data array</chart>
- For tables: <table headers="col1,col2,...">JSON rows array</table>

Always be direct and actionable. End with a specific recommendation when relevant.
Never make up data.
Current date: ${new Date().toISOString().split('T')[0]}`],
            ["placeholder", "{chat_history}"],
            ["user", "{input}"],
            ["placeholder", "{agent_scratchpad}"],
        ]);

        const tools = this.buildTools(orgId);
        const agent = createToolCallingAgent({ llm, tools, prompt });
        const agentExecutor = new AgentExecutor({ agent, tools });

        try {
            // Stream tokens
            const stream = await agentExecutor.streamEvents({ input: userQuery }, { version: "v2" });

            let finalOutput = "";

            for await (const event of stream) {
                if (event.event === "on_chat_model_stream") {
                    const chunk = event.data?.chunk?.content || "";
                    if (chunk) {
                        finalOutput += chunk;
                        yield { data: JSON.stringify({ token: chunk, done: false }) };
                    }
                }
            }

            await this.prisma.aIQuery.create({
                data: { orgId, userId, query: userQuery, response: finalOutput, latencyMs: 1500 }
            });

            yield { data: JSON.stringify({ done: true }) };
        } catch (error: any) {
            this.logger.error("AI Stream Error", error);
            yield { data: JSON.stringify({ token: "\n[Error processing query]", done: true }) };
        }
    }

    async voiceQuery(orgId: string, userId: string, audioBuffer: Buffer, mimeType: string) {
        if (!this.openaiClient) {
            return { transcription: "AI is not configured.", response: "Please add OPENAI_API_KEY" };
        }

        // Temp save buffer to pass to OpenAI (Whisper requires a file stream, not just buffer natively easily without tricks)
        const tempPath = `/tmp/${uuid()}.webm`;
        fs.writeFileSync(tempPath, audioBuffer);

        try {
            const transcription = await this.openaiClient.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: 'whisper-1',
                response_format: 'text',
            });

            // Upload to S3 for history
            await this.storageService.upload(`voice/${orgId}/${uuid()}.webm`, audioBuffer, mimeType);

            // Now run standard query on transcription
            const aiResponse = await this.query(orgId, userId, transcription as unknown as string);
            return { transcription, response: aiResponse.response };
        } finally {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
    }

    async getCustomerInsights(orgId: string, customerId: string) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                orders: { orderBy: { createdAt: 'desc' }, take: 5, select: { netAmount: true, createdAt: true, status: true } },
                invoices: { where: { status: { in: ['SENT', 'OVERDUE'] } }, select: { balanceAmount: true, dueDate: true, status: true } },
            }
        });

        if (!customer) throw new Error("Customer not found");

        if (!llm) return { summary: "AI not configured.", churnRisk: "Unknown", recommendAction: "Configure OPENAI_API_KEY" };

        const prompt = `Analyze this distribution customer data and provide insights:
${JSON.stringify(customer)}

Return ONLY a JSON response in this exact schema:
{
  "summary": "2-3 sentences max about their buying pattern and value to the business",
  "churnRisk": "LOW|MEDIUM|HIGH",
  "recommendAction": "Specific 1 sentence recommendation for the salesman"
}`;

        const res = await llm.invoke(prompt);

        try {
            const text = res.content.toString();
            const match = text.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { summary: "Failed to parse", churnRisk: "UNKNOWN", recommendAction: "None" };
        } catch {
            return { summary: "Error analyzing data", churnRisk: "UNKNOWN", recommendAction: "None" };
        }
    }

    async getSalesInsights(orgId: string) {
        if (!llm) return { insights: ["AI not configured. Add OPENAI_API_KEY."] };

        const topProducts = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: { order: { orgId, status: { in: ['DELIVERED', 'DISPATCHED'] } } },
            _sum: { totalAmount: true, quantity: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 5
        });

        const recentOrders = await this.prisma.order.aggregate({
            where: { orgId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
            _sum: { netAmount: true },
            _count: { id: true }
        });

        const prompt = `Act as an expert FMCG distribution data analyst. Analyze this 7-day data.
Top Products (IDs mapping to revenue/qty): ${JSON.stringify(topProducts)}
7-Day Trajectory: ${JSON.stringify(recentOrders)}

Return a JSON array of 3 distinct, actionable insights strings (max 150 chars each). Example:
["Insight 1", "Insight 2", "Insight 3"]`;

        const res = await llm.invoke(prompt);
        try {
            const text = res.content.toString();
            const match = text.match(/\[[\s\S]*\]/);
            return { insights: match ? JSON.parse(match[0]) : ["Data processed successfully."] };
        } catch {
            return { insights: ["Error generating insights"] };
        }
    }

    async getSchemeRecommendations(orgId: string) {
        if (!llm) return { recommendations: [] };

        const inventory = await this.prisma.inventory.findMany({
            where: { orgId, quantity: { gt: 50 } },
            include: { product: true },
            take: 10
        });

        const prompt = `You are a distributor scheme/promo designer. Design 2 exact trade schemes to move this high-stock inventory.
Inventory: ${JSON.stringify(inventory.map(i => ({ name: i.product.name, price: i.product.minStockLevel, stock: i.quantity })))}

Return ONLY JSON array:
[
  { "title": "Scheme Title", "description": "How it works", "targetProduct": "Product Name" }
]`;

        const res = await llm.invoke(prompt);
        try {
            const text = res.content.toString();
            const match = text.match(/\[[\s\S]*\]/);
            return match ? JSON.parse(match[0]) : [];
        } catch {
            return [];
        }
    }

    async processShelfAudit(orgId: string, imageBuffer: Buffer, mimeType: string, notes?: string) {
        if (!this.openaiClient) {
            return {
                analysis: "AI is not configured. Add OPENAI_API_KEY.",
                detectedProducts: [],
                competitorPresence: false,
                estimatedShareOfShelf: 0
            };
        }

        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64Image}`;

        const prompt = `You are an expert retail execution auditor. Analyze this shelf image for an FMCG distributor.
Notes from rep: ${notes || 'None'}

Return ONLY a JSON object exactly matching this schema:
{
  "analysis": "1 paragraph summary of shelf condition (facings, out of stock, compliance)",
  "detectedProducts": ["Brand A 500g", "Brand B 1kg"],
  "competitorPresence": true/false,
  "estimatedShareOfShelf": 45 (as integer percentage)
}`;

        try {
            const response = await this.openaiClient.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: dataUri } }
                        ]
                    }
                ],
                max_tokens: 500,
            });

            const text = response.choices[0]?.message?.content || "";
            const match = text.match(/\{[\s\S]*\}/);

            // Upload audit image to S3 for history
            const tempPath = `audits/${orgId}/${uuid()}.jpg`;
            await this.storageService.upload(tempPath, imageBuffer, mimeType);

            return match ? JSON.parse(match[0]) : { error: "Failed to parse analysis" };
        } catch (err: any) {
            this.logger.error("Vision Analysis Error", err);
            return { error: "Vision processing failed." };
        }
    }

    async generateAndSaveEmbedding(productId: string) {
        if (!this.openaiClient) return;

        const product = await this.prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) return;

        const textToEmbed = `${product.name} ${product.description || ''} ${product.category || ''} ${product.brand || ''}`.trim();

        try {
            const response = await this.openaiClient.embeddings.create({
                model: 'text-embedding-3-small',
                input: textToEmbed,
            });
            const embedding = response.data[0].embedding;

            await this.prisma.$executeRaw`
                UPDATE "Product" 
                SET embedding = ${embedding}::vector 
                WHERE id = ${productId}
            `;
        } catch (error) {
            this.logger.error(`Failed to generate embedding for ${productId}`, error);
        }
    }

    async semanticProductSearch(orgId: string, query: string, limit = 10) {
        if (!this.openaiClient) return [];

        try {
            const response = await this.openaiClient.embeddings.create({
                model: 'text-embedding-3-small',
                input: query,
            });
            const embedding = response.data[0].embedding;

            const products = await this.prisma.$queryRaw`
                SELECT id, name, sku, category, brand, mrp, selling_price as "sellingPrice", 1 - (embedding <=> ${embedding}::vector) as similarity
                FROM "Product"
                WHERE org_id = ${orgId} AND is_active = true
                ORDER BY similarity DESC
                LIMIT ${limit}
            `;

            return products;
        } catch (error) {
            this.logger.error("Semantic search failed", error);
            return [];
        }
    }

    async backfillEmbeddings(orgId: string) {
        if (!this.openaiClient) return { message: "AI not configured" };

        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true }
        });

        let count = 0;
        for (const product of products) {
            // Simplified batched backfill check (in full prod we'd queue these or check if embedding is null)
            await this.generateAndSaveEmbedding(product.id);
            count++;
        }

        return { message: `Queued/processed embeddings for ${count} products.` };
    }
}
