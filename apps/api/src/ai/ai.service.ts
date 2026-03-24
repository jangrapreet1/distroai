import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service as StorageService } from '../storage/s3.service';
import { ChatOpenAI } from '@langchain/openai';
import { detectLanguage } from './utils/language-detector';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, SystemMessage, ToolMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import Redis from 'ioredis';

// Tools
import { createQuerySalesTool } from './tools/query-sales';
import { createGetInventoryTool } from './tools/get-inventory';
import { createGetPaymentsTool } from './tools/get-payments';
import { createGetForecastTool, createGetCustomerTool, createGetSalesmanTool } from './tools/get-forecast-customer-salesman';
import { createGetSuppliersTool, createRunReportTool } from './tools/get-suppliers-report';
import { createGetProductDetailsTool } from './tools/product-actions';
import { createCreateOrderTool, createCancelOrderTool } from './tools/order-actions';
import { createUpdatePaymentTool, createGetCustomerBalanceTool } from './tools/finance-actions';
import { v4 as uuid } from 'uuid';

let _llm: ChatOpenAI | null = null;
let _llmInitialized = false;

export function getLlm(): ChatOpenAI | null {
    if (!_llmInitialized) {
        _llmInitialized = true;
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (apiKey) {
            _llm = new ChatOpenAI({
                modelName: 'nvidia/nemotron-3-super-120b-a12b:free',
                apiKey: apiKey,
                temperature: 0,
                configuration: {
                    baseURL: "https://openrouter.ai/api/v1",
                }
            });
        }
    }
    return _llm;
}

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

    private openaiClient = process.env.OPENROUTER_API_KEY
        ? null // Vision handled directly through LangChain
        : null;

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

    private buildTools(orgId: string, userId?: string) {
        return [
            createQuerySalesTool(orgId, this.prisma),
            createGetInventoryTool(orgId, this.prisma),
            createGetPaymentsTool(orgId, this.prisma),
            createGetForecastTool(orgId, this.prisma),
            createGetCustomerTool(orgId, this.prisma),
            createGetSalesmanTool(orgId, this.prisma),
            createGetSuppliersTool(orgId, this.prisma),
            createRunReportTool(orgId, this.prisma),
            // Phase 15: Action-Oriented Tools
            createGetProductDetailsTool(orgId, this.prisma),
            createCreateOrderTool(orgId, userId || 'system', this.prisma),
            createCancelOrderTool(orgId, userId || 'system', this.prisma),
            createUpdatePaymentTool(orgId, userId || 'system', this.prisma),
            createGetCustomerBalanceTool(orgId, this.prisma),
        ];
    }

    async query(orgId: string, userId: string, userQuery: string, sessionId?: string) {
        if (!getLlm()) {
            return { response: "AI is not configured. Please add OPENROUTER_API_KEY to environment variables." };
        }

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        const orgName = org?.name || 'your organization';
        const detectedLang = detectLanguage(userQuery);

        const systemMsg = `You are DistroAI, an intelligent business assistant for ${orgName}, an Indian distribution business.
You have access to business data tools. Use them when the user asks about real business data.
Language: Respond in ${detectedLang === 'hi' ? 'Hindi (Devanagari script mixed with business terms in English)' : 'English'}.
Data format: All monetary values in Indian format with ₹ symbol. Dates: DD MMM YYYY. Numbers: Indian system.
Always be direct and actionable. Never make up data.
Current date: ${new Date().toISOString().split('T')[0]}`;

        const tools = this.buildTools(orgId, userId);
        const toolMap = new Map(tools.map(t => [t.name, t]));
        const llmWithTools = getLlm()!.bindTools(tools);
        const messages: BaseMessage[] = [new SystemMessage(systemMsg), new HumanMessage(userQuery)];
        const timeoutMs = 30000;

        try {
            const result: string = await Promise.race([
                (async () => {
                    for (let round = 0; round <= 5; round++) {
                        const response = await llmWithTools.invoke(messages);
                        const toolCalls = (response as any).tool_calls ?? [];
                        if (toolCalls.length === 0) {
                            return typeof response.content === 'string' ? response.content : '';
                        }
                        messages.push(new AIMessage({ content: response.content || '', tool_calls: toolCalls }));
                        for (const tc of toolCalls) {
                            const tool = toolMap.get(tc.name);
                            try {
                                const res = tool ? await tool.invoke(tc.args) : `Tool '${tc.name}' not found.`;
                                messages.push(new ToolMessage({ tool_call_id: tc.id, content: typeof res === 'string' ? res : JSON.stringify(res) }));
                            } catch (e: any) {
                                messages.push(new ToolMessage({ tool_call_id: tc.id, content: `Error: ${e.message}` }));
                            }
                        }
                    }
                    return '';
                })(),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
            ]) as string;

            await this.prisma.aIQuery.create({
                data: { orgId, userId, sessionId, query: userQuery, response: result, latencyMs: 0 }
            });

            return { response: result };
        } catch (error: any) {
            if (error.message === 'timeout') {
                return { response: "I'm sorry, that query took too long to process. Try a simpler question." };
            }
            this.logger.error("AI Query Error", error);
            return { response: "There was an error processing your query. Please try again." };
        }
    }

    async getHistory(orgId: string, userId: string) {
        return this.prisma.aIQuery.findMany({
            where: { orgId, userId },
            orderBy: { createdAt: 'asc' },
            take: 50
        });
    }

    async * queryStream(orgId: string, userId: string, userQuery: string, imageBase64?: string, sessionId?: string): AsyncIterable<{ data: string }> {
        if (!getLlm()) {
            yield { data: JSON.stringify({ token: "AI is not configured. Please add OPENROUTER_API_KEY.", done: true }) };
            return;
        }

        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        const orgName = org?.name || 'your organization';
        const detectedLang = detectLanguage(userQuery);

        // Immediate persistence for background generation
        const aiQueryRecord = await this.prisma.aIQuery.create({
            data: { orgId, userId, query: userQuery, response: "", latencyMs: 0 }
        });
        const aiQueryRecordId = aiQueryRecord.id;
        let finalOutput = '';

        // If image provided, use Gemini Vision
        let imageContext = '';
        if (imageBase64) {
            try {
                const visionLlm = new ChatOpenAI({
                    modelName: 'google/gemini-2.5-flash',
                    apiKey: process.env.OPENROUTER_API_KEY!,
                    temperature: 0,
                    configuration: {
                        baseURL: "https://openrouter.ai/api/v1",
                    }
                });
                const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
                const visionResponse = await visionLlm.invoke([
                    new HumanMessage({
                        content: [
                            { type: 'text', text: 'Identify the product in this image. First describe it briefly, then provide a short clean 1-3 word search query to find this product in a database by name or sku. Format: "Search: <query>" at the end.' },
                            { type: 'image_url', image_url: { url: imageUrl } },
                        ],
                    })
                ]);

                const visionText = typeof visionResponse.content === 'string' ? visionResponse.content : '';
                imageContext = `\n\n[The user uploaded a product image. Vision analysis: ${visionText}]\n`;

                // Extract 'Search: ...' and lookup in DB
                const searchMatch = visionText.match(/Search:\s*(.+)/i);
                if (searchMatch && searchMatch[1]) {
                    const query = searchMatch[1].trim().replace(/['"]/g, '');
                    // Split query into terms (e.g. "Parle G 800g" -> ["Parle", "G", "800g"])
                    const terms = query.split(/\s+/).filter(t => t.length > 2).slice(0, 3);

                    if (terms.length > 0) {
                        const products = await this.prisma.product.findMany({
                            where: {
                                orgId,
                                AND: terms.map(term => ({
                                    OR: [
                                        { name: { contains: term, mode: 'insensitive' } },
                                        { sku: { contains: term, mode: 'insensitive' } },
                                        { brand: { contains: term, mode: 'insensitive' } }
                                    ]
                                }))
                            },
                            include: { inventories: { select: { quantity: true, warehouse: { select: { name: true } } } } },
                            take: 3
                        });

                        if (products.length > 0) {
                            imageContext += `[Database Search Results for "${query}":\n`;
                            products.forEach(p => {
                                const stockInfo = p.inventories.map(i => `${i.quantity} at ${i.warehouse.name}`).join(', ') || 'Out of stock, 0 total';
                                imageContext += `- ${p.name} (brand: ${p.brand || 'N/A'}, sku: ${p.sku}) | Price: ₹${p.sellingPrice} | MRP: ₹${p.mrp} | Stock: ${stockInfo}\n`;
                            });
                            imageContext += `]`;
                        } else {
                            imageContext += `[No exact products found in database for "${query}".]`;
                        }
                    }
                }
            } catch (err: any) {
                this.logger.error('Vision analysis failed', err);
                imageContext = '\n\n[User uploaded an image but vision analysis failed]';
            }
        }

        const systemPrompt = `You are DistroAI, an intelligent business assistant for ${orgName}, an Indian distribution business.
You have access to business data tools. Use them ONLY when the user asks about real business data (sales, inventory, orders, customers, payments, etc.).
For greetings, general questions, or conversations that don't need data, respond directly without using any tools.

You can also TAKE ACTIONS when asked:
- Create/cancel orders, record payments, look up product details, check customer balances
- When performing actions, confirm what you did clearly.

Language: Respond in ${detectedLang === 'hi' ? 'Hindi (Devanagari script mixed with business terms in English)' : 'English'}.
Data format: All monetary values in Indian format with ₹ symbol. Dates: DD MMM YYYY. Numbers: Indian system (lakh/crore).
When data suits visualization, use XML tags:
- <chart type="bar|line|pie" title="...">JSON data array</chart>
- <table headers="col1,col2,...">JSON rows array</table>
Always be direct and actionable. Never make up data. If a tool returns no data, say so clearly.
Current date: ${new Date().toISOString().split('T')[0]}`;

        const tools = this.buildTools(orgId, userId);
        const toolMap = new Map(tools.map(t => [t.name, t]));

        // Bind tools to LLM — the LLM decides whether to use them (like ChatGPT/Claude)
        const llmWithTools = getLlm()!.bindTools(tools);

        const messages: BaseMessage[] = [
            new SystemMessage(systemPrompt),
            new HumanMessage(userQuery + imageContext),
        ];

        try {
            const MAX_TOOL_ROUNDS = 5; // Safety limit to prevent infinite loops

            for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
                // Stream the LLM response
                const stream = await llmWithTools.stream(messages);
                let chunks: any[] = [];

                for await (const chunk of stream) {
                    chunks.push(chunk);
                    // Stream text content to the client immediately
                    const text = typeof chunk.content === 'string' ? chunk.content : '';
                    if (text) {
                        finalOutput += text;
                        yield { data: JSON.stringify({ token: text, done: false }) };
                    }
                }

                // Reconstruct the full AI message from chunks
                if (chunks.length === 0) break;
                let fullMessage = chunks[0];
                for (let i = 1; i < chunks.length; i++) {
                    fullMessage = fullMessage.concat(chunks[i]);
                }

                // Check if the LLM wants to call tools
                const toolCalls = fullMessage.tool_calls ?? [];
                if (toolCalls.length === 0) {
                    // No tool calls — LLM responded directly, we're done
                    break;
                }

                // Execute each tool call and collect results
                this.logger.log(`LLM requested ${toolCalls.length} tool call(s): ${toolCalls.map((tc: any) => tc.name).join(', ')}`);
                messages.push(new AIMessage({ content: fullMessage.content || '', tool_calls: toolCalls }));

                for (const toolCall of toolCalls) {
                    const tool = toolMap.get(toolCall.name);
                    if (tool) {
                        try {
                            const result = await tool.invoke(toolCall.args);
                            messages.push(new ToolMessage({
                                tool_call_id: toolCall.id,
                                content: typeof result === 'string' ? result : JSON.stringify(result),
                            }));
                        } catch (toolErr: any) {
                            this.logger.error(`Tool ${toolCall.name} failed`, toolErr);
                            messages.push(new ToolMessage({
                                tool_call_id: toolCall.id,
                                content: `Error: ${toolErr.message}`,
                            }));
                        }
                    } else {
                        messages.push(new ToolMessage({
                            tool_call_id: toolCall.id,
                            content: `Tool '${toolCall.name}' not found.`,
                        }));
                    }
                }
                // Loop back: send tool results to LLM for the final response
            }

            yield { data: JSON.stringify({ done: true }) };
        } catch (error: any) {
            this.logger.error('AI Stream Error', error);
            yield { data: JSON.stringify({ token: '\n[Error processing query]', done: true }) };
        } finally {
            if (aiQueryRecordId) {
                await this.prisma.aIQuery.update({
                    where: { id: aiQueryRecordId },
                    data: { response: finalOutput }
                }).catch(e => this.logger.error('Failed to update AI query history', e));
            }
        }
    }

    async voiceQuery(orgId: string, userId: string, audioBuffer: Buffer, mimeType: string, sessionId?: string) {
        if (!getLlm()) {
            return { transcription: 'AI is not configured.', response: 'Please add OPENROUTER_API_KEY' };
        }

        // Gemini 2.0 Flash supports audio directly via inline data
        const base64Audio = audioBuffer.toString('base64');

        try {
            const visionLlm = new ChatOpenAI({
                modelName: 'google/gemini-2.5-flash',
                apiKey: process.env.OPENROUTER_API_KEY!,
                temperature: 0,
                configuration: {
                    baseURL: "https://openrouter.ai/api/v1",
                }
            });

            const transcriptionResponse = await visionLlm.invoke([
                new HumanMessage({
                    content: [
                        { type: 'text', text: 'Transcribe this audio accurately. Return only the transcribed text, nothing else.' },
                        { type: 'media', data: base64Audio, mimeType: mimeType as any },
                    ],
                })
            ]);

            const transcription = transcriptionResponse.content.toString();

            // Upload to S3 for history
            await this.storageService.upload(`voice/${orgId}/${uuid()}.webm`, audioBuffer, mimeType);

            const aiResponse = await this.query(orgId, userId, transcription, sessionId);
            return { transcription, response: aiResponse.response };
        } catch (err: any) {
            this.logger.error('Voice query failed', err);
            return { transcription: 'Could not transcribe audio', response: 'Voice processing failed. Please try typing your query.' };
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

        if (!getLlm()) return { summary: "AI not configured.", churnRisk: "Unknown", recommendAction: "Configure OPENROUTER_API_KEY" };

        const prompt = `Analyze this distribution customer data and provide insights:
${JSON.stringify(customer)}

Return ONLY a JSON response in this exact schema:
{
  "summary": "2-3 sentences max about their buying pattern and value to the business",
  "churnRisk": "LOW|MEDIUM|HIGH",
  "recommendAction": "Specific 1 sentence recommendation for the salesman"
}`;

        const res = await getLlm()!.invoke(prompt);

        try {
            const text = res.content.toString();
            const match = text.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { summary: "Failed to parse", churnRisk: "UNKNOWN", recommendAction: "None" };
        } catch {
            return { summary: "Error analyzing data", churnRisk: "UNKNOWN", recommendAction: "None" };
        }
    }

    async getSalesInsights(orgId: string) {
        if (!getLlm()) return { insights: ["AI not configured. Add OPENROUTER_API_KEY."] };

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

        const res = await getLlm()!.invoke(prompt);
        try {
            const text = res.content.toString();
            const match = text.match(/\[[\s\S]*\]/);
            return { insights: match ? JSON.parse(match[0]) : ["Data processed successfully."] };
        } catch {
            return { insights: ["Error generating insights"] };
        }
    }

    async getSchemeRecommendations(orgId: string) {
        if (!getLlm()) return { recommendations: [] };

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

        const res = await getLlm()!.invoke(prompt);
        try {
            const text = res.content.toString();
            const match = text.match(/\[[\s\S]*\]/);
            return match ? JSON.parse(match[0]) : [];
        } catch {
            return [];
        }
    }

    async processShelfAudit(orgId: string, imageBuffer: Buffer, mimeType: string, notes?: string) {
        if (!getLlm()) {
            return {
                analysis: 'AI is not configured. Add OPENROUTER_API_KEY.',
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
  "competitorPresence": true,
  "estimatedShareOfShelf": 45
}`;

        try {
            const visionLlm = new ChatOpenAI({
                modelName: 'google/gemini-2.5-flash',
                apiKey: process.env.OPENROUTER_API_KEY!,
                temperature: 0,
                configuration: {
                    baseURL: "https://openrouter.ai/api/v1",
                }
            });

            const response = await visionLlm.invoke([
                new HumanMessage({
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: dataUri } },
                    ],
                })
            ]);

            const text = response.content.toString();
            const match = text.match(/\{[\s\S]*\}/);

            // Upload audit image to S3 for history
            const tempPath = `audits/${orgId}/${uuid()}.jpg`;
            await this.storageService.upload(tempPath, imageBuffer, mimeType);

            return match ? JSON.parse(match[0]) : { error: 'Failed to parse analysis' };
        } catch (err: any) {
            this.logger.error('Vision Analysis Error', err);
            return { error: 'Vision processing failed.' };
        }
    }

    async generateAndSaveEmbedding(productId: string) {
        // Gemini embeddings not wired yet — skip gracefully
        return;
    }

    async semanticProductSearch(orgId: string, query: string, limit = 10) {
        // Simple text search (Gemini embeddings not yet wired)
        try {
            const products = await this.prisma.product.findMany({
                where: {
                    orgId,
                    isActive: true,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { sku: { contains: query, mode: 'insensitive' } },
                        { category: { contains: query, mode: 'insensitive' } },
                        { brand: { contains: query, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                select: { id: true, name: true, sku: true, category: true, brand: true, mrp: true, sellingPrice: true },
            });
            return products;
        } catch (error) {
            this.logger.error('Semantic search failed', error);
            return [];
        }
    }

    async backfillEmbeddings(orgId: string) {
        return { message: 'Embeddings not configured (using Gemini). Skipped.' };
    }
}
