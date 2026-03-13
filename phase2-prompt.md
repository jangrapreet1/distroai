# Phase 2: Backend Core — DistroAI NestJS API

Phase 1 is complete. The monorepo is set up with Turborepo, shared packages (@distroai/config, types, utils, ui) exist, Docker Compose is running Postgres (port 5433, pgvector enabled) and Redis (port 6380), the full Prisma schema is migrated, seed data is loaded, and CI/CD is configured.

Now build Phase 2: the complete NestJS backend API in apps/api/.

---

## CONTEXT

- Postgres runs on port 5433 (not default 5432)
- Redis runs on port 6380 (not default 6379)
- Use the existing Prisma schema in packages/db/prisma/schema.prisma
- Import shared types from @distroai/types
- Import shared utilities from @distroai/utils
- All NestJS code goes in apps/api/

---

## STEP 1 — NestJS App Bootstrap

Set up apps/api/ with:

- NestJS 10 with TypeScript strict mode
- Global pipes: ValidationPipe with whitelist: true, forbidNonWhitelisted: true, transform: true
- Global filters: AllExceptionsFilter that returns consistent error shape: { success: false, error: { code, message, details? }, timestamp, path }
- Global interceptors: LoggingInterceptor (log request method, path, status, duration), TransformInterceptor (wrap successful responses in { success: true, data, meta? })
- Helmet for security headers
- CORS configured from CORS_ORIGINS environment variable (comma-separated list)
- Swagger/OpenAPI at /api/docs with bearer auth configured
- Health check endpoint GET /health returns { status: 'ok', db: 'connected', redis: 'connected', timestamp }
- Rate limiting via @nestjs/throttler: 100 requests/minute per IP globally, configurable per endpoint
- ConfigModule with validation using Joi for all required environment variables

Required environment variables to validate on startup:
DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, NODE_ENV

---

## STEP 2 — Database & Prisma Module

Create a PrismaModule (global) that:
- Provides PrismaService extending PrismaClient
- Connects on module init, disconnects on module destroy
- Implements a global middleware that automatically appends orgId to all queries for multi-tenant isolation
- The orgId injection works via AsyncLocalStorage — the Auth guard stores orgId in context, Prisma middleware reads it
- Logs slow queries (over 500ms) as warnings
- In development, logs all queries

---

## STEP 3 — Auth Module

Implement full authentication at /api/v1/auth/*.

### POST /api/v1/auth/register
Body: { orgName, phone, email, password, firstName, lastName?, gstNumber? }
- Validate email format and phone (Indian mobile: 10 digits starting with 6-9)
- Hash password with bcrypt (12 rounds)
- Create Organization + User (role: OWNER) in a single Prisma transaction
- Create default Warehouse named "Main Godown" for the org
- Create default OrgSettings with Indian defaults (timezone: Asia/Kolkata, language: en, invoicePrefix: INV, financialYearStart: 04-01)
- Create Subscription with status TRIAL, plan GROWTH, expiresAt = now + 14 days
- Generate access token + refresh token
- Store refresh token hashed (bcrypt, 8 rounds) in RefreshToken table
- Return: { accessToken, refreshToken, user: { id, email, firstName, role }, org: { id, name, plan } }

### POST /api/v1/auth/login
Body: { email, password, orgId? }
- If multiple orgs share same email, require orgId to disambiguate (return list of orgs if not provided)
- Verify password with bcrypt
- Update User.lastLoginAt
- Generate and return tokens same as register
- Return 401 with code AUTH_INVALID_CREDENTIALS for any failure (do not distinguish email vs password)

### POST /api/v1/auth/refresh
Body: { refreshToken }
- Find RefreshToken record, verify not expired
- Compare provided token hash against stored hash
- Invalidate old refresh token (delete from DB)
- Issue new access token + new refresh token (rotation)
- Return new token pair

### POST /api/v1/auth/logout
Requires auth. Body: { refreshToken }
- Delete the RefreshToken record
- Return { success: true }

### POST /api/v1/auth/forgot-password
Body: { phone } or { email }
- Generate 6-digit OTP, store in Redis with key otp:{phone/email} with 10-minute expiry
- In development: log OTP to console
- In production: send via MSG91 SMS or Resend email
- Return { message: 'OTP sent' } (never confirm if account exists)

### POST /api/v1/auth/reset-password
Body: { identifier, otp, newPassword }
- Verify OTP from Redis, delete after verification (one-time use)
- Hash new password, update User
- Invalidate all existing refresh tokens for this user
- Return { success: true }

### GET /api/v1/auth/me
Requires auth. Returns full user profile + org + subscription.

### JWT Strategy
- Access token payload: { sub: userId, orgId, role, email }
- Access token expiry from JWT_ACCESS_EXPIRY env var (default 15m)
- Refresh token: random 64-byte hex string, stored hashed
- JwtAuthGuard: global guard, skip with @Public() decorator
- Extract token from Authorization: Bearer {token} header

---

## STEP 4 — Multi-Tenant Guard & Plan Limit Guard

### OrgContextGuard
Runs after JwtAuthGuard on all authenticated routes.
- Reads orgId from JWT payload
- Fetches org + subscription from DB (cache in Redis for 60 seconds, key: org:{orgId})
- Stores { org, subscription } in request context
- If org.isActive is false: return 403 with ACCOUNT_SUSPENDED

### PlanLimitGuard
Decorator-based: @RequiresPlan(Plan.STARTER) or @RequiresFeature('whatsappBot')
- Checks current org's plan against required plan
- Checks feature flags from PLAN_LIMITS config
- Returns 402 with { code: 'PLAN_LIMIT_REACHED', feature, currentPlan, requiredPlan, upgradeUrl: '/settings/billing' }

### PLAN_LIMITS config object
```typescript
export const PLAN_LIMITS = {
  FREE: {
    maxUsers: 1,
    maxMonthlyInvoices: 100,
    maxProducts: 50,
    maxCustomers: 100,
    maxAiQueriesPerMonth: 10,
    features: {
      whatsappBot: false,
      salesmanApp: false,
      shelfAudit: false,
      customReports: false,
      tallySync: false,
      apiAccess: false,
    }
  },
  STARTER: {
    maxUsers: 3,
    maxMonthlyInvoices: Infinity,
    maxProducts: 500,
    maxCustomers: 1000,
    maxAiQueriesPerMonth: 100,
    features: {
      whatsappBot: true,
      salesmanApp: true,
      shelfAudit: false,
      customReports: false,
      tallySync: false,
      apiAccess: false,
    }
  },
  GROWTH: {
    maxUsers: 10,
    maxMonthlyInvoices: Infinity,
    maxProducts: Infinity,
    maxCustomers: Infinity,
    maxAiQueriesPerMonth: 500,
    features: {
      whatsappBot: true,
      salesmanApp: true,
      shelfAudit: true,
      customReports: true,
      tallySync: true,
      apiAccess: false,
    }
  },
  ENTERPRISE: {
    maxUsers: Infinity,
    maxMonthlyInvoices: Infinity,
    maxProducts: Infinity,
    maxCustomers: Infinity,
    maxAiQueriesPerMonth: Infinity,
    features: {
      whatsappBot: true,
      salesmanApp: true,
      shelfAudit: true,
      customReports: true,
      tallySync: true,
      apiAccess: true,
    }
  },
};
```

---

## STEP 5 — Users Module

### GET /api/v1/users
Requires role: OWNER or ADMIN.
Query params: role?, isActive?, page (default 1), limit (default 20, max 100)
Returns paginated list of users in org.

### POST /api/v1/users
Requires role: OWNER or ADMIN.
Body: { email, firstName, lastName?, phone?, role }
- Check plan user limit before creating
- Generate temporary password (random 12 chars)
- Create User with isActive: true
- TODO: send onboarding SMS/WhatsApp (log to console for now, wire up in Phase 4)
- Return created user (without passwordHash)

### GET /api/v1/users/:id
Returns user. Must belong to same org.

### PATCH /api/v1/users/:id
Body: partial user fields (not role, not passwordHash)
Only OWNER/ADMIN can update other users. Users can update their own profile.

### DELETE /api/v1/users/:id
Requires OWNER. Sets isActive: false. Cannot deactivate self.

### PATCH /api/v1/users/:id/role
Requires OWNER only. Body: { role }
Cannot change own role.

---

## STEP 6 — Products Module

### GET /api/v1/products
Query: search?, category?, brand?, isActive? (default true), page, limit
- Full text search on name + sku + barcode
- Returns products with current total inventory quantity (sum across warehouses)
- Cache results for 30 seconds in Redis

### POST /api/v1/products
Body: full product fields
- Auto-generate SKU if not provided: {brand_prefix}-{category_prefix}-{random4}
- Create Inventory record for default warehouse with quantity 0

### POST /api/v1/products/import
Multipart: { file: Excel/CSV }
- Parse with xlsx library
- Validate each row (required: name, sellingPrice, gstRate)
- Upsert by SKU (update if exists, create if not)
- Return { created, updated, failed, errors[] }

### GET /api/v1/products/:id
Returns product with inventory breakdown per warehouse + batch list (sorted by expiry asc).

### PATCH /api/v1/products/:id
Partial update.

### DELETE /api/v1/products/:id
Soft delete: isActive = false.

### GET /api/v1/products/low-stock
Returns all products where current quantity <= minStockLevel.
Include: product details, current qty, minStockLevel, deficit (minStockLevel - currentQty), lastForecastedDemand if available.

### GET /api/v1/products/expiring
Query: days (default 30)
Returns ProductBatch records where expiryDate <= now + days.
Group by product. Include: product name, batchNumber, expiryDate, quantity, daysRemaining.

---

## STEP 7 — Inventory Module

### GET /api/v1/inventory
Returns all products with inventory per warehouse.
Structure: [{ product, warehouses: [{ warehouse, quantity, reservedQty, availableQty }] }]
Query: warehouseId?, lowStockOnly?

### POST /api/v1/inventory/adjust
Requires role: OWNER, ADMIN, or MANAGER.
Body: { productId, warehouseId, quantity (can be negative), reason, type: 'ADJUSTMENT' }
- Run in Prisma transaction: update Inventory.quantity, create InventoryTransaction
- Validate: resulting quantity cannot go below 0
- Write to AuditLog

### POST /api/v1/inventory/transfer
Body: { productId, fromWarehouseId, toWarehouseId, quantity }
- Transaction: deduct from source, add to destination, create two InventoryTransaction records
- Validate available quantity (quantity - reservedQty) in source

### GET /api/v1/inventory/transactions
Query: productId?, warehouseId?, type?, dateFrom?, dateTo?, page, limit
Returns paginated transaction log with product + warehouse details.

### GET /api/v1/inventory/valuation
Returns: [{ warehouseId, warehouseName, totalValue (sum of qty * purchasePrice), productCount }]
Plus grand total across all warehouses.

---

## STEP 8 — Customers Module

### GET /api/v1/customers
Query: search? (name, phone, email), type?, tier?, salesmanId?, routeId?, page, limit
Returns customers with outstandingAmount and paymentScore.

### POST /api/v1/customers
- Check plan customer limit
- Body: all customer fields
- Geocode address if latitude/longitude not provided (Google Maps Geocoding API — skip if key not configured)

### POST /api/v1/customers/import
Multipart: { file: Excel/CSV }
Upsert by phone number.

### GET /api/v1/customers/:id
Full 360 profile:
{
  customer: all fields,
  stats: { totalOrders, totalRevenue, totalPaid, outstanding, avgOrderValue, lastOrderDate, lastVisitDate },
  recentOrders: last 5 orders,
  paymentSummary: { current: 0-30 days, overdue30: 31-60, overdue60: 61-90, overdue90: 90+ }
}

### PATCH /api/v1/customers/:id

### GET /api/v1/customers/:id/orders
Paginated order history.

### GET /api/v1/customers/:id/payments
Payment history + ageing breakdown.

### GET /api/v1/customers/:id/credit-score
Returns:
{
  score: number,
  band: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED',
  explanation: string,
  factors: [{ name, score, weight, description }],
  recommendation: string,
  history: last 10 PaymentScoreLog entries
}

### GET /api/v1/customers/dormant
Query: days (default 30)
Returns customers where lastOrderDate < now - days OR never ordered.

### GET /api/v1/customers/high-risk
Returns customers where paymentScore < 60, sorted by outstandingAmount desc.

---

## STEP 9 — Suppliers Module

### Full CRUD: GET list, POST create, GET :id, PATCH :id

### GET /api/v1/suppliers/:id
Include: recent purchase orders (last 10), performance score, average lead time actual vs promised.

---

## STEP 10 — Orders Module

This is the most critical module. Every stock change must be in a Prisma transaction. Never allow partial writes.

### GET /api/v1/orders
Query: status?, customerId?, salesmanId?, source?, dateFrom?, dateTo?, page, limit
Returns orders with customer name + item count.

### POST /api/v1/orders
Body: { customerId, warehouseId, items: [{ productId, quantity, price, discount? }], notes?, deliveryDate?, source }
- Validate: customer belongs to org, warehouse belongs to org, all products belong to org
- Calculate: totalAmount, discountAmount, taxAmount per item (use product.gstRate), netAmount
- Check stock availability for each item (quantity - reservedQty >= requested)
- Create Order with status DRAFT + all OrderItems
- Do NOT reserve inventory yet (reservation happens on CONFIRM)
- Write to AuditLog

### GET /api/v1/orders/:id
Full detail: order + items (with product details) + statusHistory + customer summary.

### PATCH /api/v1/orders/:id
Only allowed in DRAFT status.
Recalculate totals after update.

### POST /api/v1/orders/:id/confirm
- Validate status is DRAFT
- For each item: check available inventory (quantity - reservedQty >= item.quantity), throw 409 if insufficient with details of which products are short
- Transaction: update status to CONFIRMED, increment Inventory.reservedQty for each item, create OrderStatusHistory record
- Queue notification to customer (log for now)
- Write AuditLog

### POST /api/v1/orders/:id/pack
- Validate status is CONFIRMED
- Update status to PACKED + OrderStatusHistory

### POST /api/v1/orders/:id/dispatch
Body: { vehicleNumber? }
- Validate status is CONFIRMED or PACKED
- Transaction:
  1. Update status to DISPATCHED
  2. For each item: decrement Inventory.quantity, decrement Inventory.reservedQty, create InventoryTransaction (type: OUT)
  3. Create OrderStatusHistory
- Optionally auto-create invoice if org.settings.autoInvoice is true
- Write AuditLog

### POST /api/v1/orders/:id/deliver
- Validate status is DISPATCHED
- Update status to DELIVERED + statusHistory

### POST /api/v1/orders/:id/cancel
- Validate status is DRAFT or CONFIRMED or PACKED
- Transaction:
  1. Update status to CANCELLED
  2. If was CONFIRMED or PACKED: decrement Inventory.reservedQty (release reservation)
  3. Create statusHistory
- Write AuditLog

### POST /api/v1/orders/:id/return
Body: { items: [{ orderItemId, returnQty, reason }] }
- Validate original order is DELIVERED
- Validate returnQty <= original ordered quantity
- Transaction:
  1. Create new Order with type RETURN, status CONFIRMED
  2. Create OrderItems with negative quantities
  3. Add inventory back: increment Inventory.quantity for each returned item, create InventoryTransaction (type: RETURN)
- Write AuditLog

### POST /api/v1/orders/:id/invoice
- Validate order status is DISPATCHED or DELIVERED
- Validate no invoice already exists
- Create Invoice from order data (copy items, calculate GST split: CGST+SGST for same state, IGST for interstate — compare org.state vs customer.state)
- Update Order.invoiceId
- Queue: generate PDF (log for now, wire up in Phase 4)

---

## STEP 11 — Invoices Module

### GET /api/v1/invoices
Query: status?, customerId?, dateFrom?, dateTo?, page, limit
Returns with customer name + payment status.

### POST /api/v1/invoices
Direct invoice creation (without order).
Body: { customerId, invoiceDate, dueDate?, items: [{ productId, quantity, unit, price, discount?, hsnCode? }], notes? }
- Auto-generate invoiceNumber: {org.invoicePrefix}-{YYYY}-{sequential 5-digit number}
- Calculate all GST amounts (CGST+SGST vs IGST based on state comparison)
- Update Customer.outstandingAmount += invoice.totalAmount
- Queue PDF generation

### GET /api/v1/invoices/:id
Full detail with items + payment history + customer.

### POST /api/v1/invoices/:id/send
Body: { channels: ['whatsapp', 'email'] }
- Queue WhatsApp send (log for now) and/or email (log for now)
- Return { queued: true }

### POST /api/v1/invoices/:id/pdf
- Queue async PDF generation job
- Return { jobId, status: 'queued' }

### POST /api/v1/invoices/:id/e-invoice
- Placeholder: log the intent, return { status: 'not_configured', message: 'E-invoice integration will be set up in Phase 4' }

### POST /api/v1/invoices/:id/e-waybill
- Placeholder: same as above.

### POST /api/v1/invoices/:id/payment-link
- Create Razorpay payment link if RAZORPAY_KEY_ID is configured, otherwise return placeholder
- Store paymentLinkId + paymentLinkUrl on Invoice
- Queue WhatsApp message with link (log for now)

### GET /api/v1/invoices/gstr1
Query: from, to (date strings YYYY-MM-DD)
Returns structured GSTR-1 data:
{
  b2b: [{ customerGst, invoices: [...] }],
  b2c: { totalTaxableValue, totalCgst, totalSgst, totalIgst },
  summary: { totalInvoices, totalTaxableValue, totalTax, totalCess }
}

### GET /api/v1/invoices/gstr3b
Query: from, to
Returns GSTR-3B summary with all table values.

---

## STEP 12 — Payments Module

### GET /api/v1/payments
Query: customerId?, method?, status?, dateFrom?, dateTo?, page, limit

### POST /api/v1/payments
Record manual payment (cash/cheque).
Body: { invoiceId?, customerId, amount, method, referenceNumber?, notes?, paidAt? }
Transaction:
1. Create Payment with status COMPLETED
2. If invoiceId provided: add to Invoice.paidAmount, recalculate Invoice.balanceAmount, update Invoice.status (PARTIAL if balance > 0, PAID if balance = 0)
3. Update Customer.outstandingAmount -= amount
4. Trigger payment score recalculation (async)
Write AuditLog.

### POST /api/v1/payments/razorpay-webhook
No auth required. Verify razorpay-signature header using HMAC SHA256.
Handle events:
- payment.captured: find Invoice by razorpayOrderId, mark payment complete (same transaction as above)
- payment.failed: update Payment status to FAILED, notify owner
- subscription.charged, subscription.cancelled: update Subscription record

### GET /api/v1/payments/outstanding
Returns outstanding grouped by customer with ageing buckets:
[{
  customer: { id, name, phone, paymentScore },
  total: number,
  buckets: { current: 0-30 days, overdue30, overdue60, overdue90 },
  oldestInvoice: { invoiceNumber, dueDate, amount },
  paymentLinkUrl: string | null
}]
Sorted by total outstanding desc.

### GET /api/v1/payments/collection-plan
Returns AI-prioritized list for today's collections.
Priority formula: score = (daysOverdue * 0.4) + (outstandingAmount/1000 * 0.3) + ((100 - paymentScore) * 0.3)
Returns top 20 customers sorted by priority score desc.
Include: customer contact, outstanding amount, suggested collection amount, last payment date.

---

## STEP 13 — Analytics Module (Basic)

### GET /api/v1/analytics/dashboard
Returns all KPI data for the main dashboard:
{
  today: { revenue, orders, collections, newCustomers },
  thisMonth: { revenue, orders, collections, avgOrderValue },
  inventory: { lowStockCount, expiringCount, totalValue },
  collections: { totalOutstanding, overdueCount, collectionRate },
  topProducts: top 5 by revenue this month,
  topCustomers: top 5 by revenue this month,
  recentOrders: last 10 orders,
  alerts: [{ type, message, severity, entityId, entityType }]
}
Cache for 5 minutes in Redis.

### GET /api/v1/analytics/sales
Query: from, to, groupBy (product|customer|salesman|category|day|week|month)
Returns aggregated sales data with totals.

### GET /api/v1/analytics/collections
Query: from, to
Returns: totalCollected, avgCollectionDays, ageing distribution, collection rate by salesman.

---

## STEP 14 — Purchase Orders Module

### GET /api/v1/purchase-orders, POST /api/v1/purchase-orders, GET/PATCH /api/v1/purchase-orders/:id

### POST /api/v1/purchase-orders/:id/receive
Body: { items: [{ poItemId, receivedQty, batchNumber?, expiryDate? }] }
Transaction:
1. Update each PurchaseOrderItem.receivedQty
2. Add to Inventory: increment Inventory.quantity, create InventoryTransaction (type: IN)
3. If has batchNumber + expiryDate: create ProductBatch record
4. If all items fully received: update PO status to RECEIVED
Write AuditLog.

---

## STEP 15 — Audit Log Module

### AuditLogService (injectable)
Method: log({ userId, orgId, action, entityType, entityId, oldValue?, newValue?, request? })
- Writes to AuditLog table
- Never throws — if logging fails, swallow error and log to console only

### GET /api/v1/audit (OWNER only)
Query: entityType?, entityId?, userId?, dateFrom?, dateTo?, page, limit
Returns paginated audit trail.

---

## STEP 16 — Notifications Module (Stub)

Create NotificationService with methods:
- sendWhatsApp(orgId, to, message, templateName?) — log to console for now
- sendSMS(to, message) — log to console
- sendEmail(to, subject, body) — log to console
- sendPush(userId, title, body, data?) — log to console
- queueNotification(type, payload) — log to console

These will be wired to real providers in Phase 4. For now they just log.

---

## STEP 17 — Org & Settings Endpoints

### GET /api/v1/org — Returns org + settings + subscription
### PATCH /api/v1/org — Update org profile. OWNER only.
### GET /api/v1/org/settings — Returns OrgSettings
### PATCH /api/v1/org/settings — Update settings. OWNER only.
### GET /api/v1/org/subscription — Returns subscription + current usage vs plan limits

---

## STEP 18 — Testing

For every module above, write:

Integration tests using @nestjs/testing + supertest + a test Postgres database.
- Use a separate test database: DATABASE_URL_TEST env var
- Before each test: reset relevant tables
- Test: happy path, validation errors (wrong types, missing required fields), auth failures (no token, wrong role), multi-tenant isolation (user from org A cannot access org B resources)

Unit tests for:
- Payment score calculation function
- GST calculation (CGST+SGST vs IGST determination)
- Order total calculation
- Collection priority score formula
- Invoice number auto-generation

---

## VALIDATION & ERROR HANDLING STANDARDS

All validation errors return HTTP 400:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "must be a valid email" }]
  }
}

Business logic errors return appropriate codes:
- 401 AUTH_INVALID_CREDENTIALS, AUTH_TOKEN_EXPIRED, AUTH_TOKEN_INVALID
- 402 PLAN_LIMIT_REACHED
- 403 FORBIDDEN, ACCOUNT_SUSPENDED
- 404 NOT_FOUND with entityType in message
- 409 CONFLICT (e.g., insufficient stock, duplicate invoice number)
- 422 UNPROCESSABLE (e.g., cannot cancel a delivered order)

All error responses follow the same shape. Never leak stack traces in production.

---

## CODE QUALITY STANDARDS

- Zero use of 'any' type. Use unknown and type-narrow.
- All async operations use try/catch or proper NestJS exception handling
- Never swallow errors silently (except AuditLogService)
- Every Prisma query that modifies data must be in a transaction
- Every module must have its own module file, controller, service, DTOs folder, and test file
- DTOs use class-validator decorators + Swagger @ApiProperty decorators
- Services must not contain HTTP-specific logic (no req/res objects in services)
- Use dependency injection throughout — no module-level singletons

---

## WHAT TO DELIVER

At the end of Phase 2:

1. apps/api/ with complete NestJS application
2. All 17 modules implemented with controllers, services, DTOs
3. Swagger docs accessible at /api/docs showing all endpoints
4. GET /health returning healthy status
5. All integration tests passing
6. Unit tests for business logic functions
7. Updated .env.example with all required variables
8. README update: how to run the API locally

Do NOT build:
- WhatsApp bot (Phase 4)
- AI features (Phase 5)
- PDF generation (Phase 4)
- Email/SMS/push sending (Phase 4)
- Razorpay live integration (stubs only)
- Frontend (Phase 3)
- Mobile app (Phase 6)

Build everything else completely and correctly.
