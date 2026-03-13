# Phase 5: AI Brain — LangChain Agent, Demand Forecasting, Shelf Audit, Voice

Phases 1–4 are complete:
- Monorepo, Docker, Prisma schema, CI/CD (Phase 1)
- 17 NestJS modules, full REST API, 9/9 unit tests (Phase 2)
- 14-page Next.js dashboard, PWA, 12/12 tests (Phase 3)
- BullMQ queues, WhatsApp 7-flow bot (DB-persisted), Razorpay, PDF invoices, S3, 5 cron jobs, all notification channels, e-invoice, Tally bridge, 30/30 tests (Phase 4)

Now build Phase 5: the complete AI intelligence layer.

---

## CONTEXT

- AI endpoints already exist as stubs in apps/api/src/ai/ — implement them fully
- Python FastAPI microservice goes in apps/ai-service/ (new)
- The DistroAI Chat page in apps/web/app/(dashboard)/ai/page.tsx has stub responses — wire to real API
- All AI calls must gracefully fall back if OpenAI/Anthropic keys not set (return a helpful "AI not configured" message, never crash)
- Required new env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY (fallback), AI_SERVICE_URL

---

## STEP 1 — Python FastAPI AI Microservice (apps/ai-service/)

Create a standalone Python FastAPI service that handles heavy ML tasks.

### Setup
```
apps/ai-service/
  main.py              — FastAPI app
  requirements.txt     — prophet, scikit-learn, pandas, numpy, fastapi, uvicorn, psycopg2-binary, sqlalchemy, python-dotenv
  Dockerfile           — python:3.11-slim, installs requirements, runs uvicorn on port 8000
  .env.example         — DATABASE_URL (same Postgres), PORT=8000
```

### Endpoints

**POST /forecast/run**
Input: `{ org_id: str, product_id: str, horizon_days: int = 30 }`
Output: `{ dates: list[str], predicted: list[float], lower: list[float], upper: list[float], confidence: float, reorder_point: float, reorder_qty: float, model_used: str }`

Algorithm:
1. Query PostgreSQL directly for this product's daily sales for last 12 months:
   ```sql
   SELECT DATE(created_at) as sale_date, SUM(quantity) as qty
   FROM order_items oi
   JOIN orders o ON oi.order_id = o.id
   WHERE o.org_id = :org_id AND oi.product_id = :product_id
   AND o.status IN ('DELIVERED', 'DISPATCHED')
   AND o.created_at >= NOW() - INTERVAL '12 months'
   GROUP BY DATE(created_at)
   ORDER BY sale_date
   ```
2. Fill missing dates with 0
3. If fewer than 30 days of data: use weighted moving average (last 7 days weighted 3x, last 14 days weighted 2x, rest 1x). Set model_used = "moving_average"
4. If 30-89 days of data: use seasonal decomposition + linear trend. model_used = "trend_decomposition"
5. If 90+ days: use Facebook Prophet with:
   - Indian public holidays as holiday regressors (Diwali, Holi, Eid, Christmas, New Year, Independence Day, Republic Day, Navratri, Dussehra)
   - Weekly seasonality enabled
   - Yearly seasonality enabled if 365+ days of data
   - uncertainty_samples = 100 for confidence intervals
   - model_used = "prophet"
6. Calculate safety stock: `safety_stock = 1.65 * std_dev * sqrt(lead_time_days)` where lead_time_days fetched from Product table
7. Calculate reorder point: `reorder_point = avg_daily_demand * lead_time_days + safety_stock`
8. Calculate reorder qty: `max(forecast_next_30_days - current_stock, 0)` where current_stock from Inventory table
9. Return predictions for horizon_days starting from tomorrow

**POST /score/payment**
Input: `{ customer_id: str, org_id: str }`
Output: `{ score: int, factors: list[dict], explanation: str }`
Implement the scoring algorithm (already defined in Phase 2 TypeScript — port to Python for batch processing).

**GET /health**
Returns `{ status: "ok", prophet_available: bool }`

Add ai-service to docker-compose.yml:
```yaml
ai-service:
  build: ./apps/ai-service
  ports:
    - "8000:8000"
  environment:
    - DATABASE_URL=${DATABASE_URL}
  depends_on:
    - postgres
```

---

## STEP 2 — LangChain.js AI Agent (NestJS)

Install in apps/api/: `langchain`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/core`

### AIService (apps/api/src/ai/ai.service.ts) — replace stub

```typescript
// Initialize LLM with fallback
const llm = process.env.OPENAI_API_KEY
  ? new ChatOpenAI({ model: 'gpt-4o', temperature: 0 })
  : process.env.ANTHROPIC_API_KEY
  ? new ChatAnthropic({ model: 'claude-3-5-sonnet-20241022', temperature: 0 })
  : null;
```

### Tool Definitions (apps/api/src/ai/tools/)

Create one file per tool. Each tool is a LangChain DynamicStructuredTool:

**tool: query_sales**
Description: "Get sales data aggregated by dimension for the org"
Input schema: `{ dimension: enum['product','customer','salesman','category','day','week','month'], dateFrom: string, dateTo: string }`
Implementation: run appropriate Prisma aggregation query, return structured data

**tool: get_inventory**
Description: "Get current inventory levels, low stock items, or expiring batches"
Input schema: `{ filter: enum['all','low_stock','expiring','out_of_stock'], productId?: string }`
Implementation: query Inventory + Product, return with risk classification

**tool: get_payments**
Description: "Get outstanding payments, overdue invoices, payment history, or collection status"
Input schema: `{ type: enum['outstanding','overdue','history','collection_plan'], customerId?: string, limit?: number }`
Implementation: query invoices + payments with ageing calculation

**tool: get_forecast**
Description: "Get demand forecast for a specific product or all low-stock products"
Input schema: `{ productId?: string, type: enum['specific','reorder_list'] }`
Implementation: query DemandForecast table (pre-computed by cron), return with reorder recommendations

**tool: get_customer**
Description: "Get detailed information about a specific customer including payment score and order history"
Input schema: `{ customerId?: string, customerName?: string, type: enum['profile','top_customers','dormant','high_risk'] }`
Implementation: query Customer with relations, fuzzy match by name if customerId not provided

**tool: get_salesman**
Description: "Get field force performance data"
Input schema: `{ salesmanId?: string, period: enum['today','week','month'], metric: enum['visits','orders','collections','all'] }`
Implementation: query FieldVisit + Attendance + Orders grouped by salesman

**tool: get_suppliers**
Description: "Get supplier information and purchase recommendations"
Input schema: `{ type: enum['list','reorder_suggestions','performance'] }`
Implementation: query Supplier + PurchaseOrder, include AI reorder suggestions from forecast data

**tool: run_report**
Description: "Generate a specific business report"
Input schema: `{ reportType: enum['daily_summary','weekly_summary','top_products','gst_summary'], period?: string }`
Implementation: aggregate relevant data and return structured report

### Agent Implementation

```typescript
async query(orgId: string, userQuery: string, language: 'en' | 'hi' = 'en'): Promise<{
  response: string,
  chartData?: ChartData,
  tableData?: TableData,
  actions?: QuickAction[]
}> {

  if (!llm) {
    return { response: "AI is not configured. Please add OPENAI_API_KEY to environment variables." };
  }

  // Detect language from query (Hindi Unicode range + common Hinglish patterns)
  const detectedLang = detectLanguage(userQuery);

  // Build system prompt with org context
  const systemPrompt = buildSystemPrompt(orgId, detectedLang);

  // Initialize agent with tools (inject orgId into each tool's closure)
  const tools = buildTools(orgId, prismaService);
  const agent = createToolCallingAgent({ llm, tools, prompt });

  // Run with 30-second timeout
  const result = await Promise.race([
    agentExecutor.invoke({ input: userQuery }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
  ]);

  // Parse response: detect if it contains chart/table data
  // Agent can return structured JSON wrapped in <chart> or <table> tags
  const parsed = parseAgentResponse(result.output);

  // Log to AIQuery table
  await prisma.aIQuery.create({ data: { orgId, userId, query: userQuery, response: parsed.response, ... } });

  return parsed;
}
```

### System Prompt (build dynamically per org)
```
You are DistroAI, an intelligent business assistant for [Org Name], an Indian distribution business.

You have access to their complete business data through tools. Always use tools to get real data before answering.

Language: Respond in [language]. If Hindi, use Devanagari script mixed with business terms in English.

Data format rules:
- All monetary values: Indian format with ₹ symbol (₹1,23,456 not ₹123,456)
- Dates: DD MMM YYYY format (15 Jan 2025)
- Numbers: Indian system (1 lakh = 1,00,000; 1 crore = 1,00,00,000)

When you have data that would benefit from visualization, wrap it in XML tags:
- For charts: <chart type="bar|line|pie" title="...">JSON data array</chart>
- For tables: <table headers="col1,col2,...">JSON rows array</table>

Always be direct and actionable. End with a specific recommendation when relevant.

Never make up data. If a tool returns no data, say so clearly.
Current date: [today's date]
```

---

## STEP 3 — Voice Query Endpoint

### POST /api/v1/ai/voice-query
Accepts: multipart/form-data with `audio` file field

```typescript
async voiceQuery(orgId: string, audioFile: Express.Multer.File): Promise<AIQueryResponse> {
  // 1. Upload audio to temp S3 key
  const audioUrl = await s3Service.upload(`temp/audio/${uuid()}.webm`, audioFile.buffer, 'audio/webm');

  // 2. Transcribe with OpenAI Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFile.buffer), // pass buffer
    model: 'whisper-1',
    language: 'hi',  // hint Hindi, but Whisper auto-detects
    response_format: 'text',
  });

  // 3. Pass transcription to AI agent
  const response = await aiService.query(orgId, transcription);

  // 4. Return both transcription and AI response
  return { transcription, ...response };
}
```

---

## STEP 4 — Daily Briefing with Real AI

Update the 'generate-briefing' queue worker (currently uses hardcoded template) to use GPT-4o:

```typescript
async generateBriefing(orgId: string): Promise<string> {
  // 1. Fetch all real data from DB (no AI for data fetching)
  const data = {
    yesterday: await fetchYesterdayStats(orgId),
    lowStock: await fetchLowStockCount(orgId),
    overdue: await fetchOverdueStats(orgId),
    dormant: await fetchDormantCount(orgId),
    collectionPriorities: await fetchTopCollections(orgId, 3),
    reorderPriorities: await fetchReorderList(orgId, 2),
  };

  // 2. If OpenAI configured: use GPT-4o to write natural language briefing
  if (openai) {
    const prompt = `You are DistroAI. Write a concise WhatsApp morning briefing message for a distributor.
    Use the data below. Write in a friendly, professional tone. Use emojis sparingly.
    Include: yesterday summary, today's alerts, top 3 priorities.
    Keep it under 400 words. Format for WhatsApp (no markdown headers, use bullet points with •).
    Data: ${JSON.stringify(data)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    });
    return completion.choices[0].message.content;
  }

  // 3. Fallback: use the template from Phase 4 with real data
  return formatBriefingTemplate(data);
}
```

---

## STEP 5 — Customer AI Insights

### GET /api/v1/ai/customer-insights/:id
```typescript
async getCustomerInsights(customerId: string, orgId: string): Promise<CustomerInsights> {
  // Fetch 12 months of data for this customer
  const data = await fetchCustomerFullHistory(customerId, orgId);

  const prompt = `Analyze this Indian distributor's customer data and provide insights.
  Return a JSON object with these exact fields:
  {
    "purchasePattern": "2-3 sentence analysis of buying frequency and seasonality",
    "paymentBehavior": "2-3 sentence analysis of payment patterns",
    "riskLevel": "LOW|MEDIUM|HIGH",
    "riskFactors": ["factor1", "factor2"],
    "recommendations": [
      { "type": "credit|product|visit|payment", "text": "specific actionable recommendation" }
    ],
    "creditLimitSuggestion": number,
    "nextOrderPrediction": "when they are likely to order next"
  }
  Customer data: ${JSON.stringify(data)}`;

  const response = await llm.invoke(prompt);
  return JSON.parse(response.content);
}
```

---

## STEP 6 — Reorder Suggestions (AI-Enhanced)

### GET /api/v1/ai/reorder-suggestions
```typescript
async getReorderSuggestions(orgId: string): Promise<ReorderSuggestion[]> {
  // 1. Get all products with current stock
  // 2. Get latest DemandForecast for each
  // 3. Get supplier lead times
  // 4. Identify products where: current_stock <= reorder_point (from forecast)

  const atRiskProducts = await findAtRiskProducts(orgId);

  if (atRiskProducts.length === 0) return [];

  // 5. If AI available: use GPT to prioritize and add context
  if (llm) {
    const prompt = `You are advising an Indian distributor on inventory reordering.
    For each product, provide a priority score (1-10) and a one-line reason.
    Return JSON array: [{ productId, priority, reason, urgency: "immediate|this_week|next_week" }]
    Products at risk: ${JSON.stringify(atRiskProducts)}`;

    const aiResponse = await llm.invoke(prompt);
    const priorities = JSON.parse(aiResponse.content);
    return mergeWithAIPriorities(atRiskProducts, priorities);
  }

  // Fallback: sort by days_remaining ascending
  return atRiskProducts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
```

---

## STEP 7 — Shelf Audit Vision AI

### POST /api/v1/shelf-audit
Now fully implement (was stub in Phase 2/3).

```typescript
async analyzeShelfAudit(orgId: string, customerId: string, photoBuffer: Buffer): Promise<ShelfAuditResult> {
  // 1. Upload photo to S3
  const photoUrl = await s3Service.upload(`audits/${orgId}/${customerId}/${Date.now()}.jpg`, photoBuffer, 'image/jpeg');

  // 2. Analyze with Google Cloud Vision API
  if (process.env.GOOGLE_VISION_API_KEY) {
    const visionResult = await analyzeWithGoogleVision(photoBuffer);
    // Extract: labels, text (for product names/barcodes), objects detected

    // 3. Pass Vision results to GPT-4o Vision for shelf-specific analysis
    if (openai) {
      const analysis = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this retail shelf photo for a distributor audit.
              The distributor sells these brands: ${orgBrands.join(', ')}.
              Provide a JSON response with:
              {
                "myBrandFacings": number,
                "totalFacings": number,
                "shareOfShelf": number (percentage),
                "competitorBrands": [{ "name": string, "facings": number }],
                "outOfStockSpots": number,
                "planogramCompliance": number (0-100),
                "observations": ["observation1", "observation2"],
                "recommendations": ["recommendation1", "recommendation2"]
              }`
            },
            {
              type: 'image_url',
              image_url: { url: photoUrl }
            }
          ]
        }],
        max_tokens: 500,
      });

      const result = JSON.parse(analysis.choices[0].message.content);

      // 4. Save ShelfAudit record
      const audit = await prisma.shelfAudit.create({
        data: {
          orgId, customerId, photoUrl,
          analysisResult: result,
          myBrandFacings: result.myBrandFacings,
          competitorData: result.competitorBrands,
          compliance: result.planogramCompliance,
        }
      });

      return { auditId: audit.id, ...result };
    }
  }

  // Fallback if Vision/OpenAI not configured
  const audit = await prisma.shelfAudit.create({
    data: { orgId, customerId, photoUrl, analysisResult: { status: 'pending_ai_config' } }
  });
  return { auditId: audit.id, status: 'AI not configured. Photo saved for manual review.' };
}
```

Required new env var: `GOOGLE_VISION_API_KEY`

---

## STEP 8 — Sales Insights Endpoint

### GET /api/v1/ai/sales-insights
```typescript
async getSalesInsights(orgId: string): Promise<SalesInsights> {
  // Fetch last 90 days of sales data, grouped by week
  const salesData = await fetchWeeklySales(orgId, 90);

  if (!llm) {
    return { insight: "Enable AI to get sales insights.", data: salesData };
  }

  const prompt = `Analyze this Indian distributor's sales trend data and provide 3 key insights.
  Focus on: growth/decline trend, seasonality patterns, product mix changes, actionable recommendations.
  Data is weekly revenue for last 90 days: ${JSON.stringify(salesData)}
  Return JSON: { insights: [{ title: string, description: string, trend: "up|down|neutral" }], summary: string }`;

  const response = await llm.invoke(prompt);
  return { ...JSON.parse(response.content), data: salesData };
}
```

---

## STEP 9 — Scheme Recommendation

### GET /api/v1/ai/scheme-recommendation
```typescript
async getSchemeRecommendations(orgId: string): Promise<SchemeRecommendation[]> {
  // Fetch active schemes + their performance (orders using scheme, revenue uplift)
  const schemes = await fetchSchemesWithPerformance(orgId);

  // Fetch products that haven't moved in 15+ days (candidates for new schemes)
  const slowMovers = await fetchSlowMovingProducts(orgId, 15);

  if (!llm) return schemes.map(s => ({ ...s, aiRecommendation: null }));

  const prompt = `You are advising an Indian distributor on promotional schemes.
  Analyze current scheme performance and suggest actions.
  Return JSON: {
    extendSchemes: [{ schemeId, reason }],
    discontinueSchemes: [{ schemeId, reason }],
    newSchemeIdeas: [{ productIds: [], type: "DISCOUNT|FREE_QTY|BUNDLE", suggestion: string }]
  }
  Schemes: ${JSON.stringify(schemes)}
  Slow movers: ${JSON.stringify(slowMovers)}`;

  const response = await llm.invoke(prompt);
  return JSON.parse(response.content);
}
```

---

## STEP 10 — Streaming Response for Chat

The DistroAI chat should stream responses (tokens appear as they're generated, not all at once).

### Backend: Add streaming endpoint
**POST /api/v1/ai/query/stream** — returns Server-Sent Events (SSE)

```typescript
@Sse('query/stream')
async queryStream(@Body() dto: AIQueryDto, @Req() req): AsyncIterable<MessageEvent> {
  const stream = await llm.stream(/* agent prompt */);

  for await (const chunk of stream) {
    yield { data: JSON.stringify({ token: chunk.content, done: false }) };
  }

  yield { data: JSON.stringify({ done: true }) };
}
```

### Frontend: Update ChatInterface to use streaming
In apps/web/app/(dashboard)/ai/page.tsx:

```typescript
const response = await fetch('/api/v1/ai/query/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ query: userMessage }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

// Show empty AI message bubble immediately, append tokens as they arrive
setMessages(prev => [...prev, { role: 'ai', content: '', streaming: true }]);

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = JSON.parse(decoder.decode(value).replace('data: ', ''));
  if (!chunk.done) {
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 ? { ...m, content: m.content + chunk.token } : m
    ));
  }
}
```

---

## STEP 11 — Language Detection Utility

```typescript
// apps/api/src/ai/utils/language-detector.ts

export function detectLanguage(text: string): 'hi' | 'en' {
  // Devanagari Unicode range: \u0900-\u097F
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;

  if (hindiChars / totalChars > 0.1) return 'hi';

  // Hinglish detection (common romanized Hindi words)
  const hinglishWords = ['kya', 'kitna', 'kaun', 'kab', 'kaise', 'mujhe', 'mere', 'hamara', 'aaj', 'kal', 'abhi', 'bohot', 'bahut', 'nahi', 'haan', 'theek', 'accha'];
  const words = text.toLowerCase().split(/\s+/);
  const hinglishCount = words.filter(w => hinglishWords.includes(w)).length;

  return hinglishCount >= 2 ? 'hi' : 'en';
}
```

---

## STEP 12 — Wire Up Frontend AI Chat for Real Responses

Update apps/web/app/(dashboard)/ai/page.tsx:

1. Replace stub responses with real API calls to POST /api/v1/ai/query/stream
2. Parse `<chart>` tags in AI response → render inline Recharts component
3. Parse `<table>` tags in AI response → render inline DataTable component
4. Voice button: use browser MediaRecorder API to record audio → POST to /api/v1/ai/voice-query → show transcription + response
5. Update example prompts to use real org data context

Chart parsing:
```typescript
function parseAIResponse(text: string): { cleanText: string, charts: ChartSpec[], tables: TableSpec[] } {
  const chartRegex = /<chart type="(.*?)" title="(.*?)">(.*?)<\/chart>/gs;
  const tableRegex = /<table headers="(.*?)">(.*?)<\/table>/gs;

  const charts = [...text.matchAll(chartRegex)].map(match => ({
    type: match[1], title: match[2], data: JSON.parse(match[3])
  }));

  const tables = [...text.matchAll(tableRegex)].map(match => ({
    headers: match[1].split(','), rows: JSON.parse(match[2])
  }));

  const cleanText = text.replace(chartRegex, '').replace(tableRegex, '').trim();
  return { cleanText, charts, tables };
}
```

---

## STEP 13 — AI Usage Tracking & Rate Limiting

Track every AI query for plan limits:

```typescript
// Before every AI query:
async checkAndIncrementAIUsage(orgId: string): Promise<void> {
  const key = `ai_usage:${orgId}:${getCurrentMonthKey()}`;
  const count = await redis.incr(key);
  await redis.expire(key, 32 * 24 * 60 * 60); // 32 days

  const limit = PLAN_LIMITS[org.plan].maxAiQueriesPerMonth;
  if (count > limit) {
    throw new ForbiddenException({
      code: 'AI_QUOTA_EXCEEDED',
      message: `Monthly AI query limit (${limit}) reached. Upgrade to get more.`,
      upgradeUrl: '/settings/billing'
    });
  }
}
```

---

## STEP 14 — pgvector Semantic Search (optional but implement if time allows)

Use pgvector (already enabled in Prisma schema from Phase 1) for semantic customer/product search.

```typescript
// Generate embedding for a query
async generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Semantic product search (fuzzy — finds "Surf" even if user says "washing powder")
async semanticProductSearch(orgId: string, query: string): Promise<Product[]> {
  const embedding = await generateEmbedding(query);
  return prisma.$queryRaw`
    SELECT *, 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM products
    WHERE org_id = ${orgId} AND is_active = true
    ORDER BY similarity DESC
    LIMIT 10
  `;
}
```

Store product embeddings: when a product is created/updated, generate and store its embedding (name + description + category + brand concatenated).

This powers smarter WhatsApp order matching (voice orders that say "washing powder" find "Surf Excel").

---

## STEP 15 — Testing Phase 5

Unit tests:
- detectLanguage: test with pure Hindi (Devanagari), Hinglish, English, mixed
- parseAIResponse: test chart/table tag extraction from mock AI responses
- indianAmountToWords: already tested in Phase 4 — verify works with edge cases
- AI agent tool schemas: validate Zod schemas reject invalid inputs

Integration tests (mock OpenAI API):
- POST /api/v1/ai/query with mocked LLM response → returns structured response
- POST /api/v1/ai/voice-query with audio file → returns transcription field in response
- GET /api/v1/ai/customer-insights/:id → returns all required fields
- GET /api/v1/ai/reorder-suggestions → returns sorted list
- GET /api/v1/ai/daily-briefing → returns briefing text
- AI quota exceeded: seed org with maxAiQueriesPerMonth queries in Redis → next query returns 402

Python ai-service tests (pytest):
- /health returns 200 with prophet_available field
- /forecast/run with <30 days data: uses moving_average model
- /forecast/run with 90+ days data: uses prophet model
- /forecast/run with unknown product_id: returns 404
- Safety stock calculation: verify formula with known inputs

---

## STEP 16 — Update docker-compose.yml

```yaml
services:
  api:
    # existing config
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AI_SERVICE_URL=http://ai-service:8000
      - GOOGLE_VISION_API_KEY=${GOOGLE_VISION_API_KEY}

  ai-service:
    build:
      context: ./apps/ai-service
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=8000
    depends_on:
      - postgres
    restart: unless-stopped
```

---

## STEP 17 — New Env Vars

Add to apps/api/.env.example:
```env
# AI / LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...   # fallback if OpenAI not available

# Google Vision (shelf audit)
GOOGLE_VISION_API_KEY=

# AI Service (Python FastAPI)
AI_SERVICE_URL=http://localhost:8000
```

---

## WHAT TO DELIVER

At end of Phase 5:

1. apps/ai-service/ — Python FastAPI service with Prophet forecasting (running in Docker)
2. LangChain agent with 8 tools fully implemented — handles any business question
3. Streaming SSE endpoint for real-time chat
4. Voice query (Whisper transcription → AI response)
5. Daily briefing uses real GPT-4o (with template fallback)
6. Customer AI insights endpoint returning structured JSON
7. Reorder suggestions with AI prioritization
8. Shelf audit with GPT-4o Vision + Google Vision
9. Sales insights and scheme recommendation endpoints
10. Language detection (Hindi/Hinglish/English)
11. AI usage tracking enforcing plan limits
12. pgvector semantic search for products
13. Frontend chat updated: streaming tokens, inline charts/tables, voice input
14. All tests passing (unit + integration + pytest)
15. .env.example updated, docker-compose updated

Do NOT build:
- React Native mobile app (Phase 6)
- Kubernetes production deployment (Phase 7)
- Payment gateway beyond what Phase 4 built

Build everything else to production quality. All AI features must gracefully degrade when API keys are not configured.
