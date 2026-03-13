import { useState } from "react";

const sections = [
  {
    id: "mission",
    title: "0. Mission Briefing",
    icon: "🎯",
    color: "#C9A84C",
    content: `You are building DistroAI — a full-stack, AI-native SaaS platform for Indian distributors and traders. This is not a prototype. This is a production-grade, launch-ready application used by real businesses managing real money.

TARGET USER: Indian FMCG/trading distributors doing ₹10L–₹100Cr/year in revenue, 1–50 employees, tier-1 to tier-3 cities.

CORE PROMISE: Replace WhatsApp + Excel + Tally with one intelligent platform that runs their entire distribution business and tells them what to do next.

COMPETITORS TO BEAT: Bizom, FieldAssist, BeatRoute, Channelplay, Vyapar, MargERP. Study their UX. Be simpler, faster, and smarter than all of them.`
  },
  {
    id: "stack",
    title: "1. Tech Stack — Non-Negotiable",
    icon: "⚙️",
    color: "#7B5EA7",
    content: `FRONTEND:
• Framework: Next.js 14 (App Router)
• Language: TypeScript (strict mode, zero 'any' types)
• Styling: Tailwind CSS + shadcn/ui
• State: Zustand (global) + TanStack Query (server state)
• Forms: React Hook Form + Zod validation
• Charts: Recharts + react-chartjs-2
• Tables: TanStack Table v8
• Mobile: React Native (Expo) — shares logic with web
• PWA: Next.js PWA plugin (installable on Android)

BACKEND:
• Runtime: Node.js 20 LTS
• Framework: NestJS (modular, injectable, testable)
• Language: TypeScript
• API: REST (/api/v1/*) + GraphQL (Apollo Server)
• Auth: JWT (access + refresh tokens) + Passport.js
• Queue: BullMQ with Redis
• Cron: NestJS Schedule

DATABASE:
• Primary: PostgreSQL 15 (Supabase or self-hosted)
• ORM: Prisma (full migration history required)
• Cache: Redis 7
• Search: PostgreSQL full-text + pgvector for AI embeddings
• Files: AWS S3 or Cloudflare R2

AI / ML:
• LLM: OpenAI GPT-4o (primary), Claude 3.5 Sonnet (fallback)
• Orchestration: LangChain.js (agents + tool use)
• Embeddings: text-embedding-3-small
• Forecasting: Python FastAPI microservice (Prophet / scikit-learn)
• Image Recognition: Google Cloud Vision API
• Voice: OpenAI Whisper API (Hindi + English + regional languages)

INTEGRATIONS:
• WhatsApp: Meta WhatsApp Business API (via 360dialog or Wati BSP)
• Payments: Razorpay (UPI, payment links, payouts)
• GST: GSTN API + NIC e-invoice API + NIC e-waybill API
• Maps: Google Maps Platform
• SMS: MSG91 | Email: Resend | Push: Firebase FCM
• Tally: Tally XML sync bridge (Tally Prime compatible)

INFRASTRUCTURE:
• Dev: Docker + Docker Compose
• Prod: Kubernetes on AWS EKS
• CI/CD: GitHub Actions
• CDN: Cloudflare | Monitoring: Sentry + Datadog
• Secrets: AWS Secrets Manager`
  },
  {
    id: "schema",
    title: "2. Database Schema (Prisma — ALL Models)",
    icon: "🗄️",
    color: "#E07B39",
    content: `Generate complete Prisma schema with all fields, relations, indexes, constraints.

REQUIRED MODELS:

Organization — Multi-tenant root.
Fields: id, name, gstNumber, panNumber, phone, email, address fields, logoUrl, plan (FREE/STARTER/GROWTH/ENTERPRISE), planExpiresAt, isActive, timestamps.

User — Fields: id, orgId, email, phone, passwordHash, firstName, lastName, role (OWNER/ADMIN/MANAGER/SALESMAN/ACCOUNTANT/VIEWER), avatarUrl, isActive, lastLoginAt, fcmTokens[], preferredLang, timestamps. Unique on (orgId, email).

RefreshToken — Fields: id, userId, token (unique), expiresAt, createdAt.

Warehouse — Fields: id, orgId, name, code, address, city, state, pincode, latitude, longitude, isDefault, timestamps. Unique on (orgId, code).

Product — Fields: id, orgId, name, sku, barcode, hsnCode, category, brand, unit, secondaryUnit, conversionFactor, purchasePrice, sellingPrice, mrp, gstRate, cessRate, minStockLevel, maxStockLevel, leadTimeDays, isActive, imageUrl, description, tags[], timestamps. Unique on (orgId, sku). Index on (orgId, category) and (orgId, brand).

ProductBatch — Fields: id, productId, warehouseId, batchNumber, manufactureDate, expiryDate, quantity, purchasePrice, createdAt. Index on (productId, expiryDate).

Inventory — Fields: id, orgId, productId, warehouseId, quantity, reservedQty (for pending orders), updatedAt. Unique on (productId, warehouseId).

InventoryTransaction — Fields: id, inventoryId, type enum (IN/OUT/ADJUSTMENT/TRANSFER/RETURN), quantity, referenceId, referenceType, note, createdAt, createdBy.

Customer — Fields: id, orgId, name, contactPerson, phone, altPhone, email, gstNumber, panNumber, fullAddress, city, state, pincode, latitude, longitude, type enum (RETAILER/WHOLESALER/INSTITUTION), tier enum (GOLD/SILVER/BRONZE), creditLimit, creditDays, outstandingAmount, paymentScore 0-100 AI-computed, routeId, beatDay, salesmanId, tags[], notes, photoUrl, isActive, whatsappNumber, lastOrderDate, lastVisitDate, timestamps.

Supplier — Fields: id, orgId, name, contactPerson, phone, email, gstNumber, panNumber, address fields, creditDays, leadTimeDays, performanceScore, notes, isActive, timestamps.

Order — Fields: id, orgId, orderNumber, customerId, salesmanId, warehouseId, status enum (DRAFT/CONFIRMED/PACKED/DISPATCHED/DELIVERED/CANCELLED/RETURNED), type enum (SALE/RETURN/SAMPLE/REPLACEMENT), source enum (APP/WHATSAPP/PHONE/WEB/PORTAL), totalAmount, discountAmount, taxAmount, netAmount, paidAmount, balanceAmount, notes, deliveryDate, deliveryAddress, schemeId, invoiceId, timestamps. Unique on (orgId, orderNumber). Index on (orgId, status), (orgId, customerId), (orgId, createdAt).

OrderItem — Fields: id, orderId, productId, quantity, unit, price, discount, taxRate, taxAmount, totalAmount.

OrderStatusHistory — Fields: id, orderId, fromStatus, toStatus, note, changedBy, createdAt.

PurchaseOrder — Fields: id, orgId, poNumber, supplierId, status enum (DRAFT/SENT/ACKNOWLEDGED/RECEIVED/CANCELLED), totalAmount, expectedDate, receivedDate, notes, timestamps.

PurchaseOrderItem — Fields: id, poId, productId, orderedQty, receivedQty, price, taxRate, totalAmount.

Invoice — Fields: id, orgId, invoiceNumber, customerId, invoiceDate, dueDate, status enum (DRAFT/SENT/PARTIAL/PAID/OVERDUE/CANCELLED), subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, cessAmount, totalAmount, paidAmount, balanceAmount, placeOfSupply, reverseCharge bool, eInvoiceIrn, eWayBillNumber, pdfUrl, notes, timestamps. Unique on (orgId, invoiceNumber).

InvoiceItem — Fields: id, invoiceId, productId, description, hsnCode, quantity, unit, price, discount, taxableAmt, gstRate, cgstRate, sgstRate, igstRate, cessRate, totalAmount.

Payment — Fields: id, orgId, invoiceId, customerId, amount, method enum (CASH/UPI/CHEQUE/BANK_TRANSFER/CREDIT), referenceNumber, status enum (PENDING/COMPLETED/FAILED/REFUNDED), razorpayOrderId, razorpayPaymentId, paymentLinkId, paymentLinkUrl, paidAt, notes, createdAt.

Salesman — Fields: id, orgId, userId (unique), employeeCode, name, phone, territory, targetMonthly, isActive, createdAt.

Route — Fields: id, orgId, salesmanId, name, day (MON/TUE/WED/THU/FRI/SAT), sequence Int[] ordered customerIds, isActive, createdAt.

FieldVisit — Fields: id, salesmanId, customerId, checkInTime, checkOutTime, checkIn/OutLat, checkIn/OutLng, checkInPhoto, purpose String[] (ORDER/COLLECTION/NEW_PRODUCT/AUDIT/RELATIONSHIP), notes, ordersPlaced, collectionAmount, shelfAuditId, createdAt.

Attendance — Fields: id, salesmanId, date, checkIn, checkOut, lat/lng, selfieUrl, status, createdAt. Unique on (salesmanId, date).

DemandForecast — Fields: id, orgId, productId, forecastDate, predictedQty, lowerBound, upperBound, confidence, modelVersion, createdAt. Index on (orgId, productId, forecastDate).

PaymentScoreLog — Fields: id, customerId, oldScore, newScore, reason, createdAt.

ShelfAudit — Fields: id, orgId, visitId, customerId, photoUrl, analysisResult JSON, myBrandFacings, competitorData JSON, compliance float 0-100, createdAt.

AIQuery — Fields: id, orgId, userId, query, response, queryType, latencyMs, createdAt.

WhatsAppConfig — Fields: id, orgId (unique), phoneNumberId, accessToken, webhookSecret, businessName, isActive, updatedAt.

WhatsAppSession — Fields: id, orgId, phone, state (bot state machine string), context JSON, lastMessage, createdAt. Unique on (orgId, phone).

WhatsAppMessage — Fields: id, orgId, phone, direction (INBOUND/OUTBOUND), messageType, content, mediaUrl, waMessageId, status, createdAt.

Scheme — Fields: id, orgId, name, type enum (DISCOUNT/FREE_QTY/BUNDLE/CASHBACK), startDate, endDate, conditions JSON, benefits JSON, isActive, createdAt.

Notification — Fields: id, orgId, userId, type, title, body, data JSON, isRead, channel String[], createdAt.

AuditLog — Fields: id, orgId, userId, action, entityType, entityId, oldValue JSON, newValue JSON, ipAddress, createdAt. Append-only — no updates or deletes ever.

Subscription — Fields: id, orgId (unique), plan, status enum (ACTIVE/CANCELLED/EXPIRED/TRIAL), currentPeriodStart, currentPeriodEnd, razorpaySubId, timestamps.

OrgSettings — Fields: id, orgId (unique), invoicePrefix, orderPrefix, poPrefix, financialYearStart, defaultWarehouseId, autoInvoice bool, paymentReminderDays Int[], whatsappBriefingTime, language, updatedAt.

INDEXING RULES: Index all foreign keys. Index all filter columns (status, createdAt, orgId combinations). Add composite indexes for common query patterns. Run EXPLAIN ANALYZE on any query that touches more than 10,000 rows.`
  },
  {
    id: "api",
    title: "3. Complete API Specification",
    icon: "🔌",
    color: "#2E8B57",
    content: `ALL endpoints require Authorization: Bearer {accessToken} header unless marked [PUBLIC].

AUTH ENDPOINTS [PUBLIC]:
POST /api/v1/auth/register — Register org + owner. Body: { orgName, gstNumber, phone, email, password, firstName }
POST /api/v1/auth/login — Returns { accessToken, refreshToken, user, org }
POST /api/v1/auth/refresh — Body: { refreshToken }. Returns new access token.
POST /api/v1/auth/logout — Revokes refresh token.
POST /api/v1/auth/forgot-password — Sends OTP to phone/email.
POST /api/v1/auth/reset-password — Body: { otp, newPassword }
GET  /api/v1/auth/me — Current user profile.

ORGANIZATION:
GET   /api/v1/org — Full org profile.
PATCH /api/v1/org — Update profile + logo upload (multipart).
GET   /api/v1/org/settings — All settings.
PATCH /api/v1/org/settings — Update settings.
GET   /api/v1/org/subscription — Current plan, usage vs limits, next billing date.
POST  /api/v1/org/subscription/upgrade — Create Razorpay subscription.

USERS:
GET    /api/v1/users — List (filter by role, isActive). Paginated.
POST   /api/v1/users — Invite user. Sends onboarding SMS/WhatsApp.
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id — Soft delete (isActive = false).
PATCH  /api/v1/users/:id/role

PRODUCTS:
GET    /api/v1/products — List (search, filter by category/brand/isActive). Paginated.
POST   /api/v1/products
POST   /api/v1/products/import — Bulk import from Excel/CSV. Returns job ID.
GET    /api/v1/products/:id — Detail with all warehouse inventory levels.
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id — Soft delete.
GET    /api/v1/products/:id/forecast — AI demand forecast next 30 days.
GET    /api/v1/products/low-stock — All products below minStockLevel.
GET    /api/v1/products/expiring — Batches expiring in N days (query param).

INVENTORY:
GET    /api/v1/inventory — Full inventory with warehouse breakdown.
POST   /api/v1/inventory/adjust — Manual adjustment. Body: { productId, warehouseId, quantity, reason, type }
POST   /api/v1/inventory/transfer — Between warehouses. Body: { productId, fromWarehouseId, toWarehouseId, quantity }
GET    /api/v1/inventory/transactions — Full audit trail. Filter by product/warehouse/date. Paginated.
GET    /api/v1/inventory/valuation — Total value by warehouse. Returns { warehouseId, totalValue, productCount }

CUSTOMERS:
GET    /api/v1/customers — List (search by name/phone, filter by type/tier/salesmanId). Paginated.
POST   /api/v1/customers
POST   /api/v1/customers/import — Bulk import.
GET    /api/v1/customers/:id — Full 360 profile.
PATCH  /api/v1/customers/:id
GET    /api/v1/customers/:id/orders — Order history. Paginated.
GET    /api/v1/customers/:id/payments — Payment history + current outstanding + ageing.
GET    /api/v1/customers/:id/credit-score — AI risk score with explanation text.
GET    /api/v1/customers/dormant — Not ordered in N days (query param, default 30).
GET    /api/v1/customers/high-risk — Payment score below 60.

ORDERS:
GET    /api/v1/orders — List (filter by status/customerId/salesmanId/date range/source). Paginated.
POST   /api/v1/orders — Create order. Validates stock availability.
GET    /api/v1/orders/:id — Detail with items + status history.
PATCH  /api/v1/orders/:id — Update (DRAFT status only).
POST   /api/v1/orders/:id/confirm — Confirm → reserves inventory quantities.
POST   /api/v1/orders/:id/pack — Mark as packed.
POST   /api/v1/orders/:id/dispatch — Dispatched → deducts inventory. Body: { vehicleNumber? }
POST   /api/v1/orders/:id/deliver — Mark delivered.
POST   /api/v1/orders/:id/cancel — Cancel + release reserved inventory.
POST   /api/v1/orders/:id/return — Create return order. Body: { items: [{ orderItemId, returnQty, reason }] }
POST   /api/v1/orders/:id/invoice — Generate invoice from order.

INVOICES:
GET    /api/v1/invoices — List (filter by status/customerId/date range). Paginated.
POST   /api/v1/invoices — Create invoice directly.
GET    /api/v1/invoices/:id — Invoice detail with payment trail.
POST   /api/v1/invoices/:id/send — Queue: generate PDF + send via WhatsApp/email.
POST   /api/v1/invoices/:id/pdf — Queue PDF generation → returns { jobId }.
POST   /api/v1/invoices/:id/e-invoice — Push to GSTN IRP → stores IRN in invoice.
POST   /api/v1/invoices/:id/e-waybill — Generate e-way bill. Body: { transporterId, vehicleNumber, distance }
POST   /api/v1/invoices/:id/payment-link — Create Razorpay link → send via WhatsApp.
GET    /api/v1/invoices/gstr1 — GSTR-1 data. Query: { from, to }. Returns structured B2B/B2C data.
GET    /api/v1/invoices/gstr3b — GSTR-3B summary for period.

PAYMENTS:
GET    /api/v1/payments — List (filter by customerId/method/status). Paginated.
POST   /api/v1/payments — Record manual payment (cash/cheque).
GET    /api/v1/payments/:id
POST   /api/v1/payments/razorpay-webhook [PUBLIC, HMAC verified] — Handle payment events.
GET    /api/v1/payments/outstanding — All outstanding grouped by customer with ageing (0-30/31-60/61-90/90+).
GET    /api/v1/payments/collection-plan — AI-prioritized collection list for today.

PURCHASE ORDERS:
GET    /api/v1/purchase-orders — List.
POST   /api/v1/purchase-orders — Create PO.
PATCH  /api/v1/purchase-orders/:id
POST   /api/v1/purchase-orders/:id/receive — Mark received. Body: { items: [{ poItemId, receivedQty }] }. Updates inventory.

SUPPLIERS:
GET    /api/v1/suppliers
POST   /api/v1/suppliers
GET    /api/v1/suppliers/:id — Detail with PO history + performance score timeline.
PATCH  /api/v1/suppliers/:id
GET    /api/v1/suppliers/intelligence — AI comparison: which suppliers to prefer, pricing trends, reorder timing.

FIELD SALES:
GET    /api/v1/salesmen — List with today's KPI summary.
POST   /api/v1/salesmen
GET    /api/v1/salesmen/:id/performance — KPIs, target vs achievement by period.
GET    /api/v1/salesmen/:id/route-today — Today's beat plan ordered by sequence + customer details.
GET    /api/v1/routes — All routes.
POST   /api/v1/routes — Create/update route with customer sequence.
POST   /api/v1/attendance/check-in — Body: { latitude, longitude, selfieBase64? }
POST   /api/v1/attendance/check-out — Body: { latitude, longitude }
POST   /api/v1/visits — Log visit. Body: { customerId, purpose[], notes, ordersPlaced, collectionAmount }
GET    /api/v1/visits — Visit history (filter by salesmanId/customerId/date). Paginated.
POST   /api/v1/shelf-audit — Body: { customerId, visitId?, photoBase64 }. Queues AI analysis.
GET    /api/v1/shelf-audit/:id — Audit results after AI processing.

AI ENDPOINTS:
POST   /api/v1/ai/query — Body: { query: string, language?: 'en'|'hi' }. Returns { response, chartData? }
POST   /api/v1/ai/voice-query — Multipart: { audioFile }. Transcribes → queries → returns response.
GET    /api/v1/ai/daily-briefing — Today's AI-generated owner briefing.
GET    /api/v1/ai/reorder-suggestions — Products to reorder now with quantities and reasoning.
GET    /api/v1/ai/sales-insights — AI commentary on recent sales trends.
GET    /api/v1/ai/customer-insights/:id — AI analysis of specific customer behavior.
POST   /api/v1/ai/shelf-audit/analyze — Analyze photo already uploaded. Returns { facings, competitors, compliance }.
GET    /api/v1/ai/scheme-recommendation — Which active schemes are performing best.

ANALYTICS:
GET    /api/v1/analytics/dashboard — Main KPI data: revenue, orders, collections, top products, alerts count.
GET    /api/v1/analytics/sales — Sales breakdown. Query: { from, to, groupBy: product|customer|salesman|region }
GET    /api/v1/analytics/inventory — Stock health, turnover rates, dead stock analysis.
GET    /api/v1/analytics/collections — Collection performance, average days to collect, ageing distribution.
GET    /api/v1/analytics/field — Field force: visits/day, orders/visit, conversion rates.
POST   /api/v1/analytics/custom — Custom report. Body: { filters, dimensions, metrics, dateRange }
POST   /api/v1/analytics/export — Async export. Body: { reportType, filters, format: 'excel'|'pdf' }. Returns { jobId }.

WHATSAPP:
GET    /api/v1/whatsapp/webhook [PUBLIC] — Meta verification (returns hub.challenge).
POST   /api/v1/whatsapp/webhook [PUBLIC, HMAC verified] — Incoming message handler.
POST   /api/v1/whatsapp/send — Send outbound message. Body: { to, message, type }
GET    /api/v1/whatsapp/config
POST   /api/v1/whatsapp/config — Save WhatsApp Business API config.
GET    /api/v1/whatsapp/messages — Message history by phone. Query: { phone }

NOTIFICATIONS:
GET    /api/v1/notifications — List for current user. Paginated.
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all`
  },
  {
    id: "features",
    title: "4. Feature Implementation Details",
    icon: "🔧",
    color: "#C9A84C",
    content: `WHATSAPP BOT STATE MACHINE:
Implement per-session state stored in WhatsAppSession.context JSON. Every incoming message reads state and transitions.

States: IDLE, MAIN_MENU, ORDER_START, ORDER_PRODUCT, ORDER_QTY, ORDER_CONFIRM, ORDER_DONE, PAYMENT_START, PAYMENT_AMOUNT, PAYMENT_DONE, CATALOGUE_VIEW, BALANCE_QUERY.

Flow 1 — ORDER (retailer → distributor):
Trigger: "order" / "order karni hai" / "mujhe order dena hai" (detect Hindi)
→ Bot: interactive WhatsApp list message with product catalogue
→ Retailer selects product → bot asks quantity
→ Bot accumulates items in session.context JSON
→ After each item: "Add more? [Yes/No]"
→ On confirm: create Order in DB → send order summary + order number
→ Push notification to owner: "New WhatsApp order from [customer] ₹X"

Flow 2 — PAYMENT LINK (distributor → retailer):
Owner triggers from web: "Send payment request to Customer X"
→ Create Razorpay payment link for outstanding amount
→ WhatsApp: "Outstanding ₹X. Pay now: [link]. Invoice attached."
→ On Razorpay payment.captured webhook: mark payment complete → send receipt

Flow 3 — VOICE ORDER:
Retailer sends voice note → Whisper API transcribes (auto-detect Hindi/English)
→ LLM extracts: [{ product, quantity }]
→ Bot: "Kya aap confirm karna chahte hain? [structured list]"
→ On confirm: create Order

Flow 4 — OWNER DAILY BRIEFING (automated cron):
Run at owner's configured time (default 8 AM IST)
Fetch: yesterday sales, today pending orders, stockout count, overdue collections
Generate via GPT-4o with org-specific data injected
Send formatted WhatsApp to all OWNER/ADMIN users

Flow 5 — PAYMENT REMINDERS (automated):
Day 3 after due: "Invoice #X for ₹Y is due. Pay: [link]"
Day 7: stronger reminder with total outstanding
Day 15: firm language, flag as high-risk in DB
Day 30+: escalation alert to owner

---

AI ASSISTANT (DistroAI Chat) — LangChain.js with GPT-4o function calling:

Tools the agent has access to:
• query_sales_data(dimension, dateFrom, dateTo, orgId) — aggregate sales by any dimension
• get_inventory_status(filter, orgId) — current stock, low stock, expiring
• get_payment_data(customerId?, status?, dateRange, orgId) — outstanding, scores
• get_demand_forecast(productId, horizonDays, orgId) — forecasts from DB
• get_customer_profile(customerId, orgId) — 360 view
• get_salesman_performance(salesmanId?, dateRange, orgId)
• generate_reorder_suggestions(orgId) — AI reorder list
• generate_chart(type, data, config) — returns chart config for frontend rendering

System prompt (inject org name + language preference):
"You are DistroAI, business assistant for [Org Name]. You have access to their complete business data. Answer questions about sales, inventory, customers, and payments accurately. Include specific numbers always. Be direct with recommendations. Respond in user's language. Format numbers Indian style (lakhs, crores)."

Test queries that must work:
• "Which products stock out this week?" → inventory + forecast lookup
• "Top 5 defaulters?" → customer query by paymentScore + outstanding
• "Should I reorder Colgate?" → stock + forecast + lead time → yes/no + quantity
• "Compare sales this vs last month" → aggregate + chart data + narrative
• "Kal kitna collection aaya?" (Hindi) → respond in Hindi

---

DEMAND FORECASTING (Python FastAPI — POST /forecast/run):
Input: { org_id, product_id, horizon_days }
Output: { dates[], predicted[], lower[], upper[], confidence, reorder_point, reorder_qty }

Algorithm:
1. Fetch last 12 months daily sales from PostgreSQL
2. Less than 60 days data → weighted moving average (recent days higher weight)
3. 60+ days data → Facebook Prophet with Indian festival holidays (Diwali, Holi, Eid, etc.)
4. Safety stock = 1.65 × std_dev × sqrt(lead_time_days) [95% service level]
5. Reorder point = avg_daily_demand × lead_time + safety_stock
6. Suggested reorder qty = forecast_next_30_days − current_stock (minimum 0)
7. Store in DemandForecast table
8. Run nightly cron at 2 AM IST for all active products

---

PAYMENT RISK SCORING:
Run after every payment event. Score 0-100 (higher = better payer).

score = 100
score -= clamp(avgPaymentDelay × 2, 0, 40)           [40% weight]
score -= (partialPaymentRatio) × 20                   [20% weight]
score -= clamp(delayTrend × 10, 0, 20)               [20% weight — worsening trend]
score -= clamp((outstanding/creditLimit − 0.7) × 40, 0, 20)  [20% weight]
score = max(0, round(score))

Bands: 80-100 Green, 60-79 Yellow, 40-59 Orange, 0-39 Red.
Log every change to PaymentScoreLog with reason string.

---

INVOICE PDF (@react-pdf/renderer server-side rendering):
Must include:
• Org logo, name, address, GSTIN, state code
• Invoice number, date, due date, place of supply
• Bill To + Ship To sections
• Item table: Name, HSN, Qty, Unit, Rate, Discount, Taxable, CGST%, CGST, SGST%, SGST, IGST%, IGST, Cess, Total
• Subtotals: Subtotal, Discount, CGST, SGST, IGST, Cess, Round-off, Grand Total
• Amount in words (Indian: Lakhs, Crores)
• QR code → payment URL with outstanding amount
• Bank account details + UPI ID
• E-invoice IRN + QR (if generated)
• Footer: "Computer generated invoice. No signature required."
• Upload PDF to S3 → return signed URL

---

TALLY INTEGRATION BRIDGE (local Windows-compatible Node.js service):
• Polls cloud API every 15 minutes for pending sync items
• Communicates with Tally Prime via built-in XML/HTTP server on port 9000
• Push invoice → Tally Sales Voucher XML
• Push payment → Tally Receipt Voucher XML  
• Pull customer ledgers from Tally → sync to Customers table
• Pull stock items from Tally → sync to Products table
• Conflict resolution: DistroAI master for orders/invoices, Tally master for accounting

---

GST / E-INVOICE / E-WAY BILL:
E-Invoice flow (mandatory above ₹5Cr turnover):
1. Generate invoice → call NIC IRP API with JSON payload
2. Receive IRN + signed QR code → store in Invoice.eInvoiceIrn
3. Embed in PDF

E-Way Bill flow (mandatory above ₹50,000 goods movement):
1. Post invoice creation → check if required
2. Call NIC e-waybill API with invoice + transporter + vehicle
3. Store e-way bill number in Invoice.eWayBillNumber`
  },
  {
    id: "frontend",
    title: "5. Frontend Page & Component Structure",
    icon: "🖥️",
    color: "#25D366",
    content: `NEXT.JS APP ROUTER STRUCTURE:
app/
  (auth)/login, register, forgot-password
  (dashboard)/
    layout.tsx — sidebar + topbar + notification bell shell
    page.tsx — dashboard: KPI cards + AI briefing + alerts feed
    orders/ — list, new (3-step form), [id] (detail + timeline)
    invoices/ — list, new, [id] (detail + payments + actions)
    inventory/ — grid, products/list, products/new, products/[id], adjustments
    customers/ — list, new, [id] (360 profile with tabs)
    suppliers/ — list, [id]
    purchase-orders/ — list, new, [id]
    payments/ — outstanding ageing, collections/ (AI priority list)
    field/ — overview map, salesmen/, routes/, visits/
    analytics/ — custom report builder, sales/, inventory/, collections/
    ai/page.tsx — DistroAI chat (full page)
    whatsapp/page.tsx — config + conversation log
    settings/ — org, users, billing, integrations, gst

KEY COMPONENTS TO BUILD:

KPICard — metric value, trend arrow, sparkline mini-chart, AI annotation text. 4 variants: revenue, orders, collections, inventory health.

AIBriefingCard — Top of dashboard. AI-generated 3 priority actions for today. Each has click-to-act button. Refresh button. Shows last generated time.

AlertsFeed — Real-time scrolling: stockout alerts, overdue payments, dormant customers, missed beats. Color-coded by severity. One-click action per alert.

OrderForm — 3-step wizard:
  Step 1: Customer search (with payment score badge, outstanding shown)
  Step 2: Product picker (search + barcode, live stock shown, AI suggested qty as placeholder)
  Step 3: Confirm (total, GST breakdown, scheme applied, expected delivery)

InvoicePreview — Pixel-perfect browser preview using @react-pdf/renderer. Shows exactly what PDF will look like. Approve button generates actual PDF.

Customer360 — Tabs: Overview (score ring, credit limit, last order, contact), Orders (sortable list), Payments (ageing bar chart + transaction list), Visits (salesman log), AI Insights (GPT analysis of this customer's behavior).

PaymentScoreRing — Circular progress indicator. Color: green 80+, yellow 60-79, orange 40-59, red 0-39. Animated on mount. Shows score number inside ring.

StockGrid — Product cards in grid. Border color = risk level. Shows: name, current stock, min stock, days remaining (from forecast), reorder button.

ForecastChart — Recharts AreaChart with: shaded confidence band (upper/lower), vertical "Today" line, horizontal "Reorder Point" line, current stock level shown as dot.

DataTable — TanStack Table v8: sticky headers, column sorting, column filters, row selection, bulk actions, export to Excel/CSV, pagination, loading skeleton state.

ChatInterface — Left panel: conversation history list. Right panel: active conversation with markdown rendering, inline chart blocks (Recharts), voice input button (records → sends audio file). Streaming response with typing indicator.

ReportBuilder — Drag-and-drop dimension/metric selector. Date range picker. Preview table. Export button. Save as template option.`
  },
  {
    id: "mobile",
    title: "6. React Native Mobile App",
    icon: "📱",
    color: "#FB923C",
    content: `SALESMAN-FACING APP SCREENS:

HomeScreen — Today's targets vs achievement. Pending visits count. Collection target. Top 3 action items. Offline indicator when no connection.

RouteScreen — Google Map with customer pins. Color-coded: unvisited (grey), current (blue), visited (green), skipped (red). Ordered list below map. "Navigate" button opens Google Maps turn-by-turn.

CheckInScreen — GPS auto-detected + shown on mini-map. Mandatory geo-tagged selfie. Alert if GPS is more than 100 meters from customer's registered location.

VisitScreen (active visit) — Tabs:
  Order: product search + barcode scan + quantity input. Shows live stock. AI suggested qty as hint.
  Collection: enter amount, select method, optional cheque photo.
  Audit: camera capture for shelf. Shows previous audit for reference.
  Notes: free text + tags.

CheckOutScreen — Visit summary: orders count, collection amount, photos taken. Required notes if no order placed. Submit ends visit + triggers sync.

NewOrderScreen — OFFLINE-CAPABLE. Full product catalog cached locally. Barcode scan to find product. Creates order in WatermelonDB local store. Queues for server sync when online.

CollectionScreen — Amount entry + method selection. Instant WhatsApp receipt to customer. Updates local ledger immediately.

AuditScreen — react-native-vision-camera full screen. Capture → preview → confirm → queue upload. View previous audit result for this customer.

PerformanceScreen — Personal KPIs: visits, orders, collection vs daily/weekly/monthly targets. Progress bars. Weekly trend sparklines.

TECHNICAL REQUIREMENTS:
• Offline: WatermelonDB local SQLite. Core data (customers, products, routes) synced to device on login. Orders/visits created offline queued in local DB and synced when online.
• Background sync: React Native Background Fetch every 30 minutes when app is closed.
• Camera: react-native-vision-camera for shelf audit photos.
• Barcode: MLKit barcode plugin for react-native-vision-camera.
• Maps: react-native-maps + Google Maps SDK.
• Geofencing: Alert if check-in GPS > 100m from customer location.
• Push: FCM for order alerts, reminders.
• APK size: under 30MB. Use dynamic imports.
• Target: Android 8+ (API 26+).`
  },
  {
    id: "jobs",
    title: "7. Background Jobs & Queues",
    icon: "⚙️",
    color: "#7B5EA7",
    content: `All queues via BullMQ + Redis. Every queue must have: 3-attempt retry with exponential backoff, dead-letter queue, job completion logging, Datadog metric emission.

NOTIFICATION_QUEUE:
• send-whatsapp: fire outbound message via WhatsApp Business API
• send-sms: MSG91 SMS
• send-push: Firebase FCM push notification
• send-email: Resend transactional email

INVOICE_QUEUE:
• generate-pdf: render with @react-pdf/renderer → upload S3 → update Invoice.pdfUrl
• send-invoice: after PDF ready, send via configured channels
• einvoice-push: call NIC IRP → store IRN
• payment-link-create: create Razorpay link → update Invoice → send WhatsApp

AI_QUEUE:
• run-forecast: nightly at 2 AM IST, demand forecast for all active products
• compute-payment-scores: daily at 6 AM, recalculate all customer scores
• generate-briefing: at configured time minus 15 minutes, generate owner briefing
• shelf-audit-analyze: triggered on photo upload, call Google Vision API, store results

PAYMENT_REMINDER_QUEUE:
• Cron: daily at 10 AM IST
• Find all overdue invoices matching reminder thresholds (3/7/15/30 days past due)
• For each: send WhatsApp + SMS with appropriate urgency level + payment link
• Day 30+ flag: update customer paymentScore and send owner alert

REPORT_QUEUE:
• generate-report: async Excel/PDF generation → send download link via email
• weekly-digest: every Monday 9 AM, generate and send weekly summary to owners

SYNC_QUEUE:
• tally-sync: every 15 minutes, push pending invoices/payments to Tally bridge`
  },
  {
    id: "security",
    title: "8. Security Requirements",
    icon: "🔒",
    color: "#E07B60",
    content: `AUTHENTICATION:
• JWT access tokens expire in 15 minutes
• Refresh tokens expire in 30 days, rotate on each use (new token issued, old invalidated)
• Store refresh tokens as bcrypt hash in RefreshToken table
• Concurrent session support (multiple devices)

MULTI-TENANCY ISOLATION:
• Every Prisma query must filter by orgId — implement global Prisma middleware that automatically appends orgId from request context
• Write integration tests explicitly proving org A cannot read org B data
• Never return orgId-less queries from any endpoint

RATE LIMITING (Redis-based):
• Auth endpoints: 5 requests/minute per IP address
• All API endpoints: 100 requests/minute per user token
• AI endpoints: 20 requests/minute per org
• WhatsApp webhook: whitelist Meta's IP ranges only

INPUT VALIDATION:
• All NestJS endpoints use class-validator + class-transformer decorators
• Whitelist validation (reject unknown fields)
• All IDs validated as CUID before database query
• Zod schemas on frontend, class-validator on backend (share base types from packages/types)

FILE UPLOADS:
• Validate MIME type from file content bytes (magic bytes), not filename extension
• Maximum 10MB per file
• Store on S3, serve via signed URLs with 15-minute expiry
• Never serve uploaded files directly from app server

WEBHOOK SECURITY:
• WhatsApp: verify X-Hub-Signature-256 HMAC using webhook secret
• Razorpay: verify razorpay-signature header on every webhook call
• Reject any webhook without valid signature with 401

ROLE-BASED DATA MASKING:
• SALESMAN: sees only their assigned customers, cannot see financial reports, cannot see other salesmen's customers or performance
• ACCOUNTANT: sees financial data + reports, cannot modify orders or manage users
• VIEWER: read-only dashboard access only
• Enforce at service layer, not just UI — API must reject unauthorized data access

AUDIT LOGGING:
• Every create/update/delete writes to AuditLog with before/after values
• AuditLog is append-only — no UPDATE or DELETE queries ever allowed on this table
• Log includes userId, orgId, IP address, timestamp, entity type and ID

SECURITY HEADERS (Helmet.js):
• Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Content-Security-Policy
• CORS: whitelist only known frontend origins from environment variable

SQL INJECTION:
• Prisma parameterized queries everywhere
• Zero raw string interpolation in SQL
• If raw SQL is needed anywhere, use Prisma's $queryRaw with tagged template literals only`
  },
  {
    id: "plans",
    title: "9. Pricing Plans & Enforcement",
    icon: "💳",
    color: "#C9A84C",
    content: `PLAN LIMITS:

FREE:
• 1 user, 100 invoices/month, 50 products, 100 customers
• 10 AI queries/month
• No: WhatsApp bot, salesman app, shelf audit, custom reports, Tally sync, API access
• New orgs start on 14-day GROWTH trial before dropping to FREE

STARTER — ₹499/month:
• 3 users, unlimited invoices, 500 products, 1000 customers
• 100 AI queries/month
• Yes: WhatsApp bot, salesman app
• No: shelf audit, custom reports, Tally sync, API access

GROWTH — ₹1499/month:
• 10 users, unlimited everything
• 500 AI queries/month
• Yes: WhatsApp bot, salesman app, shelf audit, custom reports, Tally sync
• No: API access

ENTERPRISE — ₹4999+/month:
• Unlimited users and everything
• Yes: API access, custom integrations, SLA guarantee, dedicated support

ENFORCEMENT:
• NestJS guard PlanLimitGuard checks before every feature access
• Returns HTTP 402 with { error: 'PLAN_LIMIT_REACHED', feature, currentPlan, requiredPlan, upgradeUrl }
• Frontend catches 402 → shows upgrade modal
• Usage tracked in Redis counters (reset monthly) for AI queries and invoice counts
• New org registration: auto-create 14-day GROWTH trial subscription`
  },
  {
    id: "devops",
    title: "10. DevOps & Deployment",
    icon: "🚀",
    color: "#2E8B57",
    content: `MONOREPO STRUCTURE:
distroai/
  apps/
    web/          — Next.js 14 frontend
    api/          — NestJS backend
    mobile/       — React Native (Expo)
    ai-service/   — Python FastAPI ML microservice
    tally-bridge/ — Node.js Tally sync service
  packages/
    types/        — shared TypeScript types + Zod schemas
    utils/        — shared utilities (formatCurrency, Indian number formatting, dates)
    ui/           — shared React components
    config/       — shared ESLint, TypeScript, Tailwind configs
  infra/
    docker/       — Dockerfiles per service
    k8s/          — Kubernetes manifests (deployments, services, ingress)
    terraform/    — AWS infrastructure as code (EKS, RDS, ElastiCache, S3, ECR)
  .github/workflows/ — CI/CD pipelines

Use pnpm workspaces + Turborepo for monorepo.

DOCKER COMPOSE (dev):
Services: api (NestJS), web (Next.js), ai-service (Python), worker (BullMQ workers), postgres (pgvector/pgvector:pg15), redis (redis:7-alpine), nginx (routing).

GITHUB ACTIONS CI/CD:
On push to main:
1. Run unit tests (Jest)
2. Run integration tests (Supertest against test DB in Docker)
3. Build Docker images for all services
4. Push to AWS ECR
5. kubectl apply to EKS cluster
6. Run smoke tests against prod health endpoints
7. Slack notification on success/failure

ENVIRONMENT VARIABLES REQUIRED:
NODE_ENV, APP_URL, API_URL, DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY=15m, JWT_REFRESH_EXPIRY=30d, AWS_REGION=ap-south-1, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, OPENAI_API_KEY, ANTHROPIC_API_KEY (fallback), WHATSAPP_API_URL, WHATSAPP_TOKEN, WHATSAPP_WEBHOOK_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, GSTN_CLIENT_ID, GSTN_CLIENT_SECRET, NIC_EINVOICE_USERNAME, NIC_EINVOICE_PASSWORD, GOOGLE_MAPS_API_KEY, GOOGLE_VISION_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, RESEND_API_KEY, MSG91_AUTH_KEY, SENTRY_DSN.

MONITORING:
• Sentry: error tracking for all services with org/user context
• Datadog: APM, custom metrics (orders/minute, AI latency, queue depth)
• Uptime Robot: public status page, alert on downtime
• Database: pg_stat_statements for slow query detection
• Redis: monitor queue depths, alert if dead-letter queue grows`
  },
  {
    id: "testing",
    title: "11. Testing & Performance",
    icon: "🧪",
    color: "#7B5EA7",
    content: `TESTING:

Unit tests (Jest):
• All NestJS service classes must have unit tests
• Mock Prisma client using jest-mock-extended
• Target: 80% code coverage minimum

Integration tests (Supertest):
• Every REST endpoint tested with real PostgreSQL test database
• Test: happy path, validation errors, auth failure, plan limit rejection
• Run in CI via Docker Compose test environment

E2E tests (Playwright):
• New org registration + onboarding flow
• Create order → confirm → dispatch → invoice → send via WhatsApp
• Salesman check-in → visit → order creation → check-out
• AI assistant: 5 standard query types
• Payment link creation → mock payment → verify invoice marked paid

Load tests (k6):
• Dashboard endpoint: 1000 concurrent users, P95 latency below 500ms
• Order creation: 100 concurrent requests, no inventory corruption
• Run weekly, fail CI if regression detected

Mobile tests (Detox):
• Login, check-in, offline order creation, sync when online restored

PERFORMANCE REQUIREMENTS:
• Read endpoints: P95 below 300ms
• Write endpoints: P95 below 1 second
• AI query endpoints: P95 below 8 seconds (use streaming response)
• Report generation: always async — return jobId, poll for completion

DATABASE PERFORMANCE:
• All foreign keys indexed
• Composite indexes on (orgId, status), (orgId, createdAt), (orgId, customerId)
• Run EXPLAIN ANALYZE on any query touching more than 10,000 rows
• Never write N+1 queries — use Prisma include or DataLoader pattern
• Paginate all list endpoints (default 20, max 100 per page)

FRONTEND PERFORMANCE:
• Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
• Lighthouse score > 90 on all dashboard pages
• Every route must lazy-load its components (Next.js dynamic imports)
• Prefetch data for likely next navigations`
  },
  {
    id: "build_order",
    title: "12. Build Order & Launch Checklist",
    icon: "📋",
    color: "#E07B39",
    content: `BUILD IN THIS EXACT SEQUENCE — do not skip ahead:

PHASE 1 — FOUNDATION (Week 1-2):
1. Set up pnpm monorepo with Turborepo
2. Configure shared TypeScript, ESLint, Prettier
3. Docker Compose for local dev
4. Complete Prisma schema + initial migration
5. Dev seed script with realistic test data
6. GitHub Actions CI pipeline

PHASE 2 — BACKEND CORE (Week 3-5):
7. NestJS: modules, guards, interceptors, exception filters, Swagger setup
8. Auth module: register, login, refresh, JWT guards, multi-tenant middleware
9. Products + Inventory module (all CRUD + stock management)
10. Customers + Suppliers module
11. Orders module (full status state machine with inventory reservation)
12. Invoices module (PDF generation via @react-pdf/renderer)
13. Payments module (Razorpay integration + webhook handler)

PHASE 3 — FRONTEND CORE (Week 6-8):
14. Next.js setup: auth pages, dashboard shell, sidebar navigation
15. Dashboard with KPI cards + alerts feed
16. Orders management (list + 3-step create form + detail)
17. Invoice management (list + PDF preview + send/e-invoice buttons)
18. Inventory grid + product catalog
19. Customer 360 profile pages
20. Payment outstanding + collection priority page

PHASE 4 — INTEGRATIONS (Week 9-10):
21. WhatsApp webhook handler + full bot state machine
22. GST e-invoice + e-way bill integration (test in GSTN sandbox)
23. Tally bridge service
24. BullMQ queues + all workers
25. Notification service (all channels)

PHASE 5 — AI FEATURES (Week 11-13):
26. Python FastAPI ai-service + Prophet forecasting
27. Payment risk scoring algorithm + nightly job
28. DistroAI chat: LangChain agent + all tools + streaming UI
29. Voice query endpoint (Whisper)
30. Shelf audit with Google Vision API
31. Daily owner briefing generation + automated WhatsApp delivery

PHASE 6 — FIELD SALES + MOBILE (Week 14-16):
32. Salesman, Route, FieldVisit, Attendance backend modules
33. Field analytics endpoints
34. React Native app: all screens
35. WatermelonDB offline-first sync
36. Geofencing + GPS check-in enforcement

PHASE 7 — ANALYTICS + POLISH (Week 17-18):
37. Custom report builder (frontend drag-drop + backend query engine)
38. All analytics endpoints with caching
39. Excel/PDF async export
40. Localization: Hindi (hi) minimum, others optional at launch
41. Performance optimization + load testing

PHASE 8 — LAUNCH PREP (Week 19-20):
42. Security audit: all endpoints tested for auth bypass, data isolation
43. GST invoice format legal review (consult CA)
44. Subscription enforcement end-to-end test
45. Onboarding wizard for new orgs
46. API documentation (Swagger auto-generated)
47. User guide for web + field app
48. Production deployment on AWS EKS
49. Monitoring + alerting + runbooks
50. Soft launch to 10 beta customers

PRE-LAUNCH CHECKLIST:
☐ Multi-tenant isolation: org A cannot access org B data (automated test)
☐ GST invoice legally valid (CA reviewed)
☐ E-invoice tested in GSTN sandbox
☐ Razorpay payment flow end-to-end tested
☐ WhatsApp bot tested on 5 real phone numbers
☐ Offline mode: orders created in airplane mode sync correctly on reconnection
☐ PDF renders correctly in WhatsApp preview on Android
☐ All BullMQ queues monitored with dead-letter queues
☐ Rate limiting active on all endpoints
☐ Sentry capturing errors in production
☐ Database backup tested: restore from backup in under 1 hour
☐ SSL auto-renewing
☐ Privacy policy + ToS pages live
☐ 100 concurrent orders stress test: no inventory corruption
☐ Mobile APK under 30MB
☐ DPDP Act compliance review done`
  },
  {
    id: "directive",
    title: "13. Final Directive to AI Agent",
    icon: "⚡",
    color: "#C9A84C",
    content: `This application will be used by real Indian distributors managing real inventory and real money. A shop owner in Nagpur or a distributor in Surat who has never used enterprise software will depend on this to run their business.

DESIGN PRINCIPLES — follow throughout every decision:

Simple over clever. If a feature requires a manual to use, redesign it before shipping it.

Fast over feature-rich. A slow app loses users permanently. Performance is a feature.

WhatsApp is the primary interface for field users. Build for it first, app second.

Hindi first for any field-facing text. English for admin/owner interfaces.

Data integrity above all else. Inventory quantities and invoice amounts must always be correct. Use database transactions everywhere money or stock changes hands. Never allow partial writes.

Every critical operation must be reversible or at minimum fully auditable.

Never write a query without an orgId filter. Tenant isolation is non-negotiable.

Never trust client-side data for financial calculations. All totals computed server-side.

Never skip validation. Every API input validated. Every database write in a transaction.

Document as you build. Swagger auto-generated from NestJS decorators. Update README after each phase.

Test as you build. Write tests for each module before moving to the next. Do not leave testing to Phase 7.

Build this as if a real business's livelihood depends on it.

Because it will.`
  }
];

export default function EngineerPrompt() {
  const [active, setActive] = useState("mission");
  const [copied, setCopied] = useState(false);

  const activeSection = sections.find(s => s.id === active);

  const copyAll = () => {
    const fullText = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySection = () => {
    navigator.clipboard.writeText(`## ${activeSection.title}\n\n${activeSection.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#060610", minHeight: "100vh", color: "#E0D8C8", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, #060610, #0E0B1A)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ fontSize: "10px", letterSpacing: "4px", color: "#7B5EA7", marginBottom: "8px", textTransform: "uppercase" }}>
            AI Agent Master Build Prompt · DistroAI Platform
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "clamp(20px, 3vw, 32px)", fontWeight: "400", margin: "0 0 6px", color: "#F0E8D5" }}>
                Full Engineering Specification
              </h1>
              <p style={{ color: "#5A5040", fontSize: "13px", margin: 0 }}>
                {sections.length} sections · 150+ features · Production-ready · Copy and paste into Claude Code, Cursor, or any AI coding agent
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={copySection}
                style={{ padding: "8px 16px", background: "rgba(123,94,167,0.15)", border: "1px solid rgba(123,94,167,0.4)", color: "#B89FD8", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                Copy Section
              </button>
              <button onClick={copyAll}
                style={{ padding: "8px 18px", background: copied ? "rgba(46,139,87,0.2)" : "rgba(201,168,76,0.15)", border: `1px solid ${copied ? "rgba(46,139,87,0.5)" : "rgba(201,168,76,0.4)"}`, color: copied ? "#5CC488" : "#C9A84C", borderRadius: "6px", cursor: "pointer", fontSize: "12px", transition: "all 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy Full Prompt"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%" }}>

        {/* Sidebar Nav */}
        <div style={{ width: "220px", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "20px 0" }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              style={{
                width: "100%", textAlign: "left", padding: "10px 20px",
                background: active === s.id ? `${s.color}10` : "transparent",
                borderRight: active === s.id ? `2px solid ${s.color}` : "2px solid transparent",
                border: "none", color: active === s.id ? s.color : "#5A5040",
                cursor: "pointer", fontSize: "12px", lineHeight: "1.4",
                transition: "all 0.15s ease",
                display: "flex", alignItems: "flex-start", gap: "8px",
              }}>
              <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>{s.icon}</span>
              <span>{s.title.replace(/^\d+\.\s/, '')}</span>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <span style={{ fontSize: "28px" }}>{activeSection.icon}</span>
            <h2 style={{ fontSize: "20px", color: "#F0E8D5", margin: 0, fontWeight: "400" }}>{activeSection.title}</h2>
          </div>

          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${activeSection.color}18`,
            borderRadius: "10px",
            padding: "24px",
          }}>
            <pre style={{
              margin: 0,
              fontFamily: "monospace",
              fontSize: "13px",
              lineHeight: "1.75",
              color: "#A0988A",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {activeSection.content}
            </pre>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            <button
              onClick={() => { const i = sections.findIndex(s => s.id === active); if(i > 0) setActive(sections[i-1].id); }}
              disabled={sections.findIndex(s => s.id === active) === 0}
              style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#5A5040", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
              ← Previous
            </button>
            <span style={{ fontSize: "11px", color: "#3A3020", alignSelf: "center" }}>
              {sections.findIndex(s => s.id === active) + 1} / {sections.length}
            </span>
            <button
              onClick={() => { const i = sections.findIndex(s => s.id === active); if(i < sections.length-1) setActive(sections[i+1].id); }}
              disabled={sections.findIndex(s => s.id === active) === sections.length - 1}
              style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#5A5040", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
