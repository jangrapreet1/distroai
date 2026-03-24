import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { ForbiddenException } from '@nestjs/common';

// Mock ESM modules that Jest cannot parse
jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));
jest.mock('ioredis', () => jest.fn());
jest.mock('@langchain/openai', () => ({
    ChatOpenAI: jest.fn().mockImplementation(() => ({
        bindTools: jest.fn().mockReturnValue({
            invoke: jest.fn().mockResolvedValue({ content: 'Mock response', tool_calls: [] }),
            stream: jest.fn().mockImplementation(async function* () {
                yield { content: 'Mock response' };
            })
        }),
        invoke: jest.fn().mockResolvedValue({ content: 'Mock response' }),
        stream: jest.fn().mockImplementation(async function* () {
            yield { content: 'Mock response' };
        })
    }))
}));
jest.mock('@langchain/core/prompts', () => ({ ChatPromptTemplate: { fromMessages: jest.fn() } }));
jest.mock('@langchain/core/messages', () => ({
    HumanMessage: jest.fn(),
    SystemMessage: jest.fn(),
    ToolMessage: jest.fn(),
    AIMessage: jest.fn(),
}));

// Mock the LangChain tool factories
jest.mock('./tools/query-sales', () => ({ createQuerySalesTool: jest.fn() }));
jest.mock('./tools/get-inventory', () => ({ createGetInventoryTool: jest.fn() }));
jest.mock('./tools/get-payments', () => ({ createGetPaymentsTool: jest.fn() }));
jest.mock('./tools/get-forecast-customer-salesman', () => ({
    createGetForecastTool: jest.fn(),
    createGetCustomerTool: jest.fn(),
    createGetSalesmanTool: jest.fn(),
}));
jest.mock('./tools/get-suppliers-report', () => ({
    createGetSuppliersTool: jest.fn(),
    createRunReportTool: jest.fn(),
}));

const mockPrisma = {
    organization: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    order: { aggregate: jest.fn() },
    inventory: { findMany: jest.fn() },
    aIQuery: { create: jest.fn() },
    product: { findUnique: jest.fn() },
};

const mockStorage = {
    upload: jest.fn().mockResolvedValue('https://s3.example.com/test.jpg'),
};

describe('AiService', () => {
    let service: AiService;

    beforeEach(async () => {
        // Clear env so LLM = null (graceful fallback)
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        delete process.env.REDIS_URL;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AiService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: S3Service, useValue: mockStorage },
            ],
        }).compile();

        service = module.get<AiService>(AiService);
        jest.clearAllMocks();
    });

    describe('query', () => {
        it('should return fallback message when LLM is not configured', async () => {
            const result = await service.query('org-1', 'user-1', 'Show me top customers');
            expect(result).toEqual({
                response: 'AI is not configured. Please add OPENROUTER_API_KEY to environment variables.',
            });
        });
    });

    describe('queryStream', () => {
        it('should yield fallback message when LLM is not configured', async () => {
            const stream = service.queryStream('org-1', 'user-1', 'Show me top customers');
            const results: any[] = [];
            for await (const chunk of stream) {
                results.push(chunk);
            }
            expect(results[0].data).toContain('AI is not configured');
            expect(results[0].data).toContain('OPENROUTER_API_KEY');
        });
    });

    describe('getCustomerInsights', () => {
        it('should return fallback when LLM is not configured', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                name: 'Test Customer',
                orders: [],
                invoices: [],
            });

            const result = await service.getCustomerInsights('org-1', 'cust-1');
            expect(result.summary).toBe('AI not configured.');
            expect(result.churnRisk).toBe('Unknown');
        });

        it('should throw error when customer is not found', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue(null);
            await expect(service.getCustomerInsights('org-1', 'nonexistent')).rejects.toThrow('Customer not found');
        });
    });

    describe('getSalesInsights', () => {
        it('should return fallback when LLM is not configured', async () => {
            const result = await service.getSalesInsights('org-1');
            expect(result).toEqual({ insights: ['AI not configured. Add OPENROUTER_API_KEY.'] });
        });
    });

    describe('getSchemeRecommendations', () => {
        it('should return empty array when LLM is not configured', async () => {
            const result = await service.getSchemeRecommendations('org-1');
            expect(result).toEqual({ recommendations: [] });
        });
    });

    describe('processShelfAudit', () => {
        it('should return fallback when LLM is not configured', async () => {
            const result = await service.processShelfAudit('org-1', Buffer.from('fake-image'), 'image/jpeg', 'test notes');
            expect(result).toEqual({
                analysis: 'AI is not configured. Add OPENROUTER_API_KEY.',
                detectedProducts: [],
                competitorPresence: false,
                estimatedShareOfShelf: 0,
            });
        });
    });

    describe('checkAndIncrementAIUsage', () => {
        it('should skip rate limiting when Redis is not configured', async () => {
            // No Redis → should resolve without error
            await expect(service.checkAndIncrementAIUsage('org-1')).resolves.not.toThrow();
        });
    });
});
