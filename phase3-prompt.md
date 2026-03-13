# Phase 2: Backend Core — NestJS API
Complete NestJS backend in apps/api/ using the existing monorepo setup.

Proposed Changes
STEP 1 — NestJS App Bootstrap
[NEW] apps/api/ scaffold via Nest CLI
main.ts with ValidationPipe, AllExceptionsFilter, LoggingInterceptor, TransformInterceptor
Helmet, CORS from CORS_ORIGINS env var
Swagger at /api/docs
GET /health endpoint
@nestjs/throttler rate limiting (100 req/min globally)
ConfigModule with Joi schema validation
STEP 2 — Database & Prisma Module
[NEW] apps/api/src/prisma/
PrismaService extending PrismaClient, connects on init
Global middleware for orgId multi-tenant injection via AsyncLocalStorage
Slow query logging (>500ms)
STEP 3 — Auth Module
[NEW] apps/api/src/auth/
POST /api/v1/auth/register — org + user creation, 14-day trial
POST /api/v1/auth/login — bcrypt verify, token pair
POST /api/v1/auth/refresh — token rotation
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password / reset-password (OTP via Redis)
GET /api/v1/auth/me
JWT Strategy + @Public() decorator + JwtAuthGuard as global guard
STEP 4 — Multi-Tenant & Plan Guards
[NEW] apps/api/src/common/guards/
OrgContextGuard — fetches org, caches in Redis for 60s
PlanLimitGuard + @RequiresPlan() / @RequiresFeature() decorators
PLAN_LIMITS config constant
STEP 5 — Users Module
[NEW] apps/api/src/users/
CRUD + role update + soft delete
Role-based access (OWNER/ADMIN only for most ops)
STEP 6 — Products Module
[NEW] apps/api/src/products/
List with search + filters, cached 30s
Create with auto-SKU generation
Bulk import via xlsx
Low-stock and expiring endpoints
STEP 7 — Inventory Module
[NEW] apps/api/src/inventory/
Full inventory per warehouse
Adjustment + transfer in Prisma transactions
Transaction log + valuation
STEP 8 — Customers Module
[NEW] apps/api/src/customers/
360 profile, stats, payment ageing
Credit score calculation + history
Dormant + high-risk views
STEP 9 — Suppliers Module
[NEW] apps/api/src/suppliers/
CRUD + PO history + performance score
STEP 10 — Orders Module (critical)
[NEW] apps/api/src/orders/
Full state machine: DRAFT → CONFIRMED → PACKED → DISPATCHED → DELIVERED → CANCELLED + RETURN
Inventory reservation on confirm, deduction on dispatch
All writes in Prisma transactions
STEP 11 — Invoices Module
[NEW] apps/api/src/invoices/
Create with GST split (CGST+SGST vs IGST based on state)
Auto invoice number generation
GSTR-1 and GSTR-3B endpoints
Stubs for e-invoice, e-waybill, Razorpay payment link
STEP 12 — Payments Module
[NEW] apps/api/src/payments/
Manual payment recording with invoice status update
Razorpay webhook handler with HMAC verification
Outstanding ageing view
AI-priority collection plan (formula-based)
STEP 13 — Analytics Module
[NEW] apps/api/src/analytics/
Dashboard KPIs cached 5min
Sales breakdown by multiple dimensions
Collections summary
STEP 14 — Purchase Orders Module
[NEW] apps/api/src/purchase-orders/
CRUD + receive with inventory intake + batch creation
STEP 15 — Audit Log Module
[NEW] apps/api/src/audit/
Injectable AuditLogService
GET /api/v1/audit (OWNER only)
STEP 16 — Notifications Module (Stubs)
[NEW] apps/api/src/notifications/
NotificationService with console-only stubs
STEP 17 — Org & Settings Endpoints
[NEW] apps/api/src/org/
Org profile, settings, subscription + usage
STEP 18 — Tests
[NEW] apps/api/test/
Integration tests per module (supertest + test DB)
Unit tests for: payment score, GST calc, order totals, collection priority, invoice number gen

---

# Phase 3: Frontend — Next.js Dashboard

Phase 2 is complete. 17 NestJS modules (68 files) are running in apps/api/. TypeScript compiles clean, 9/9 unit tests pass.

Now build Phase 3: the complete Next.js 14 web frontend in apps/web/.

---

## CONTEXT

- API runs at http://localhost:3000 (or API_URL env var)
- Postgres on 5433, Redis on 6380 (already running from Phase 1)
- All API types are in @distroai/types — import from there, do not redefine
- All shared utilities are in @distroai/utils (formatCurrency uses Indian format: ₹1,23,456)
- Use the existing @distroai/ui package for any shared components
- apps/web/ uses Next.js 14 App Router with TypeScript strict mode

---

## DESIGN SYSTEM

Before writing a single component, establish this design system and use it consistently everywhere.

### Color Palette (CSS variables in globals.css)
```css
:root {
  --bg-primary: #07070E;
  --bg-secondary: #0F0C1A;
  --bg-card: rgba(255, 255, 255, 0.02);
  --bg-card-hover: rgba(255, 255, 255, 0.04);
  --border: rgba(255, 255, 255, 0.07);
  --border-accent: rgba(201, 168, 76, 0.3);

  --text-primary: #F0E8D5;
  --text-secondary: #9A9080;
  --text-muted: #5A5040;

  --gold: #C9A84C;
  --gold-light: #F5D98B;
  --purple: #7B5EA7;
  --orange: #E07B39;
  --green: #2E8B57;
  --green-bright: #5CC488;
  --red: #E07B60;
  --whatsapp: #25D366;

  --success: #2E8B57;
  --warning: #C9A84C;
  --danger: #E07B60;
  --info: #7B5EA7;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-full: 9999px;

  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
}
```

### Typography (import in layout.tsx)
- Display/headings: 'Playfair Display' (Google Fonts)
- Body/UI: 'DM Sans' (Google Fonts)
- Monospace/numbers: 'JetBrains Mono' (Google Fonts)

### Component Conventions
- Cards: background var(--bg-card), border 1px solid var(--border), border-radius var(--radius-md), padding 20-28px
- Accent borders on cards use the module's color (gold for finance, purple for AI, green for field)
- All monetary values use @distroai/utils formatCurrency() — Indian format with ₹
- All dates use Indian format: DD MMM YYYY (e.g. 15 Jan 2025)
- Status badges: pill shape, colored background at 12% opacity, matching text color, 1px border
- Loading states: skeleton animation (pulse), never spinners
- Empty states: centered illustration + message + primary action button
- Tables: zebra striping (alternate row bg), sticky header, hover highlight

---

## STEP 1 — Next.js App Setup

In apps/web/:
- next.config.js with: API proxy rewrites (/api/* → API_URL), image domains, PWA plugin (@ducanh2912/next-pwa)
- globals.css with the full design system CSS variables above
- layout.tsx (root): Google Fonts import (Playfair Display, DM Sans, JetBrains Mono), metadata, Toaster (react-hot-toast), QueryClientProvider (TanStack Query), Zustand store provider
- middleware.ts: if no accessToken cookie → redirect to /login (protect all /dashboard/* routes)
- Install: tailwindcss, @tanstack/react-query, zustand, react-hot-toast, recharts, @tanstack/react-table, react-hook-form, zod, @hookform/resolvers, date-fns, lucide-react, clsx, next-pwa

---

## STEP 2 — Auth Layer

### stores/auth.store.ts (Zustand)
State: { user, org, accessToken, refreshToken, isAuthenticated }
Actions: setAuth(user, org, tokens), logout(), refreshTokens()

### lib/api-client.ts
Axios instance with:
- Base URL from NEXT_PUBLIC_API_URL env var
- Request interceptor: attach Authorization: Bearer {accessToken} from store
- Response interceptor: on 401 → call POST /api/v1/auth/refresh → retry original request → if refresh fails → logout() + redirect to /login
- All responses unwrapped from { success, data } wrapper automatically

### hooks/use-auth.ts
useAuth() hook: returns { user, org, isAuthenticated, login, logout, isLoading }

### app/(auth)/login/page.tsx
- Split layout: left panel (dark, product description + 3 key benefits with icons), right panel (login form)
- Form fields: email, password
- On submit: POST /api/v1/auth/login → store tokens in httpOnly cookies AND Zustand → redirect to /dashboard
- Link to register and forgot-password

### app/(auth)/register/page.tsx
Multi-step wizard (3 steps with progress bar):
- Step 1 Business: orgName, gstNumber (optional), phone, city, state (dropdown of Indian states)
- Step 2 Account: firstName, lastName, email, password, confirmPassword
- Step 3 Done: success screen with "Open Dashboard" CTA + 3 things to do first
- On submit (Step 2): POST /api/v1/auth/register → auto-login → redirect to /dashboard

### app/(auth)/forgot-password/page.tsx
Two-step: enter phone/email → enter OTP + new password

---

## STEP 3 — Dashboard Shell (Layout)

### app/(dashboard)/layout.tsx
Fixed sidebar (240px wide) + main content area with topbar.

SIDEBAR:
- Top: DistroAI logo + org name + plan badge
- Navigation groups:
  - OPERATIONS: Dashboard, Orders, Invoices, Inventory, Customers, Suppliers
  - FINANCE: Payments, Purchase Orders
  - FIELD: Field Force, Routes, Visits
  - INTELLIGENCE: Analytics, DistroAI Chat
  - SETTINGS: Settings, Billing
- Bottom: current user avatar + name + role + logout button
- Active state: colored left border + subtle background
- Collapse to icon-only on mobile (hamburger trigger)

TOPBAR:
- Left: breadcrumb (current page path)
- Center: global search input (Cmd+K shortcut) — stub for now, wire up later
- Right: notification bell with unread count badge, user avatar

MOBILE: sidebar becomes a slide-over drawer triggered by hamburger icon.

---

## STEP 4 — Dashboard Page (Main KPI Overview)

### app/(dashboard)/page.tsx

Layout: 2-column grid on desktop, single column on mobile.

ROW 1 — AI Briefing Card (full width):
- Card with gold accent border
- Title: "Good morning, [firstName]. Here's your day." (or appropriate greeting by time)
- 3 priority action items fetched from GET /api/v1/ai/daily-briefing (stub response for now: hardcode 3 realistic items)
- Each item has: icon, text, and a quick-action button
- "Refresh" button top-right
- Subtle animated gradient background

ROW 2 — KPI Cards (4 across):
Fetch from GET /api/v1/analytics/dashboard. Show:
1. Today's Revenue — value in ₹, vs yesterday (up/down arrow + %)
2. Orders Today — count, vs yesterday
3. Outstanding — total ₹ outstanding, number of overdue customers
4. Low Stock — count of products below min level, click navigates to inventory

Each KPI card:
- Large number in JetBrains Mono
- Trend indicator (green up arrow / red down arrow)
- Small sparkline (last 7 days) using Recharts ResponsiveContainer
- Bottom stat line with secondary metric
- Hover: slight border glow in card's accent color

ROW 3 — Sales Chart + Alerts Feed (60/40 split):

Sales Chart (left):
- Recharts AreaChart — revenue by day for last 30 days
- Toggle buttons: 7D / 30D / 90D
- Gradient fill under line
- Custom tooltip showing: date, revenue, orders count
- Below chart: AI insight strip — one sentence observation (e.g. "Sales are 23% higher than last month")

Alerts Feed (right):
- Title "Alerts" with count badge
- Scrollable list, max height 320px
- Alert types with icons and colors:
  - 🔴 Stockout imminent (red)
  - 🟡 Payment overdue (yellow)
  - 🟠 Dormant customer (orange)
  - 🟣 New WhatsApp order pending (purple)
- Each alert: icon + message + time ago + action button (e.g. "Reorder", "Collect", "View")
- Use mock data that looks realistic for now

ROW 4 — Top Products + Top Customers (50/50 split):

Top Products:
- List of 5 products, ranked by revenue this month
- Each row: rank number, product name, revenue ₹, units sold, mini bar showing % of total

Top Customers:
- List of 5 customers, ranked by revenue
- Each row: rank, customer name, city, revenue ₹, payment score ring (colored circle)

---

## STEP 5 — Orders Pages

### app/(dashboard)/orders/page.tsx — Orders List

Header: "Orders" title + "New Order" button (primary, gold)

Filters bar (horizontal, below header):
- Status tabs: All / Draft / Confirmed / Packed / Dispatched / Delivered / Cancelled
- Date range picker (last 7 days default)
- Search input (customer name or order number)
- Salesman filter dropdown

Orders table (TanStack Table):
Columns: Order # | Customer | Date | Items | Amount | Status | Source | Actions
- Order # links to detail page
- Status: colored pill badge (DRAFT=grey, CONFIRMED=blue, PACKED=yellow, DISPATCHED=orange, DELIVERED=green, CANCELLED=red)
- Source icon: app icon / WhatsApp icon / phone icon
- Amount in ₹ Indian format
- Actions: "View" button, kebab menu with: Confirm, Pack, Dispatch, Cancel (context-sensitive)
- Pagination at bottom (20 per page)
- Empty state: illustration + "No orders yet. Create your first order."

### app/(dashboard)/orders/new/page.tsx — Create Order

3-step wizard with step indicator at top:

Step 1 — Select Customer:
- Search input with dropdown autocomplete (debounced, hits GET /api/v1/customers?search=)
- Customer card preview after selection: name, phone, city, credit limit, outstanding (show warning if high outstanding)
- Payment score ring with explanation
- "Next: Add Products" button

Step 2 — Add Products:
- Search bar for products
- Product grid (4 columns on desktop): product name, SKU, price, available stock (colored: green OK / yellow low / red out)
- Click product → slide-in panel with quantity input, price override option, discount field
- Added items appear in "Order Summary" sidebar (sticky right panel):
  - List of items with quantities and totals
  - Running subtotal, GST breakdown, net total
  - Auto-applies active schemes (show scheme badge if applied)
- Can adjust quantities inline in summary
- Bottom: "Back" and "Review Order" buttons

Step 3 — Review & Confirm:
- Full order summary: customer details, all items, pricing breakdown
- Delivery date picker (optional)
- Notes textarea
- Two action buttons: "Save as Draft" and "Confirm Order" (primary)
- On confirm: POST /api/v1/orders + POST /api/v1/orders/:id/confirm → toast success → redirect to order detail

### app/(dashboard)/orders/[id]/page.tsx — Order Detail

Header: Order # + status badge + created date
Action buttons (context-sensitive based on status):
- DRAFT: "Confirm Order", "Edit", "Cancel"
- CONFIRMED: "Mark Packed", "Generate Invoice", "Cancel"
- PACKED: "Mark Dispatched"
- DISPATCHED: "Mark Delivered", "View Invoice"
- DELIVERED: "Create Return"

Two-column layout:
Left (70%):
- Order items table: product, qty, unit, price, discount, GST, total
- GST breakdown: CGST, SGST/IGST, Cess, Net Total

Right (30%):
- Customer card: name, phone, city, payment score
- Outstanding balance warning (if any)
- Linked invoice card (if exists)
- Activity timeline (status history): each status change with time + user who changed it

---

## STEP 6 — Invoices Pages

### app/(dashboard)/invoices/page.tsx — Invoice List

Header: "Invoices" + "New Invoice" button

Summary strip (horizontal cards above table):
- Total Outstanding: ₹X
- Overdue: ₹X (red)
- Collected This Month: ₹X
- GSTR-1 Ready: X invoices

Filters: Status tabs (Draft/Sent/Partial/Paid/Overdue) + Date range + Customer search

Table columns: Invoice # | Customer | Date | Due Date | Amount | Paid | Balance | Status | Actions
- Due dates in the past colored red
- Balance > 0 shows in orange
- Actions: View, Send, Download PDF, Record Payment (quick action)

### app/(dashboard)/invoices/[id]/page.tsx — Invoice Detail

This is the most important page. Make it pixel-perfect.

Top action bar: Send Invoice (WhatsApp/Email) | Download PDF | Record Payment | More (e-Invoice, e-WayBill)

Invoice preview (left 65%):
- Styled exactly like a real GST invoice
- Org header: logo, name, address, GSTIN
- Invoice details: number, date, due date
- Bill To / Ship To boxes
- Items table with all GST columns
- Totals section: subtotal, CGST, SGST/IGST, grand total
- Amount in words
- Payment terms + bank details
- "This is a computer generated invoice" footer
- Print-ready styling (CSS @media print)

Right sidebar (35%):
- Payment status card: paid ₹X / total ₹X with visual progress bar
- Payment history list (date, amount, method)
- "Record Payment" button → opens modal
- Send options: WhatsApp button (green), Email button
- Payment link section: generate/view Razorpay link

Record Payment Modal:
- Amount input (pre-filled with balance)
- Method selector: Cash / UPI / Cheque / Bank Transfer
- Reference number input (optional, required for cheque)
- Date picker (default today)
- Notes
- Submit → POST /api/v1/payments → refresh invoice data → toast success

---

## STEP 7 — Inventory Pages

### app/(dashboard)/inventory/page.tsx — Stock Overview

Header: "Inventory" + tabs: All Products | Low Stock | Expiring Soon

Summary strip: Total Products | Total Value (₹) | Low Stock Count (red badge) | Expiring in 30 days (orange badge)

View toggle: Grid view (default) / Table view

Grid view — product cards:
- Product name + brand + SKU
- Large stock number (colored: green if healthy, yellow if low, red if out)
- Progress bar: current vs max stock level
- Below bar: "Min: X" label
- If low: "Reorder" button appears
- If expiring: "Expiring" badge with days remaining
- Hover: show purchase price, selling price, GST rate

Table view: standard DataTable with all product fields + stock column + actions.

Filters: Category dropdown | Brand dropdown | Warehouse dropdown | Risk level (All/Low/Out)

### app/(dashboard)/inventory/products/[id]/page.tsx — Product Detail

Tabs: Overview | Stock History | Demand Forecast | Batches

Overview tab:
- Product info: name, SKU, barcode, category, brand, HSN code, units
- Pricing: purchase price, selling price, MRP, GST rate
- Stock across warehouses (small table)
- Quick adjustment button → opens Adjust Stock modal

Adjust Stock modal:
- Warehouse selector
- Adjustment type: Add Stock / Remove Stock / Set Exact
- Quantity input
- Reason input (required)
- Submit → POST /api/v1/inventory/adjust → toast → refresh

Demand Forecast tab:
- Recharts AreaChart showing predicted demand for next 30 days
- Shaded confidence band (upper/lower bounds)
- Horizontal line at current stock level
- Horizontal line at reorder point
- Vertical line at today
- Below chart: "Recommended reorder: X units" callout box

Stock History tab:
- Timeline of all inventory transactions
- Each entry: date, type (IN/OUT/ADJUSTMENT), quantity change (+/-), reference (order/adjustment ID), user

Batches tab:
- Table of all batches: batch number, manufacture date, expiry date, quantity
- Expiry color coding: red if < 30 days, yellow if < 90 days

---

## STEP 8 — Customers Pages

### app/(dashboard)/customers/page.tsx — Customer List

Header: "Customers" + "Add Customer" button + "Import" button

Summary: Total | Active | High Risk (red) | Dormant (orange)

Tabs: All | Gold | Silver | Bronze | High Risk | Dormant

Table columns: Name | Type | City | Phone | Last Order | Outstanding | Score | Salesman | Actions
- Score: colored circle (green/yellow/orange/red) with number
- Outstanding: colored text if > 0
- Last Order: "X days ago" format, red if > 30 days
- Actions: View, WhatsApp (opens wa.me link), Record Payment

### app/(dashboard)/customers/[id]/page.tsx — Customer 360 Profile

Hero section (top):
- Customer name (large) + type badge + tier badge (Gold/Silver/Bronze with icon)
- Key stats strip: Total Revenue | Orders | Outstanding | Last Order
- Action buttons: New Order | Record Payment | WhatsApp | Edit

Tabs: Overview | Orders | Payments | Visits | AI Insights

Overview tab:
- Two columns:
  Left: Contact info, address, GST number, credit limit, credit days, salesman assigned
  Right: Payment Score card — large circular progress ring (colored by score), score number in center, band label (Trusted/Caution/High Risk/Danger), explanation text below, history sparkline

Orders tab:
- Filterable orders table for this customer
- Quick action to create new order for this customer

Payments tab:
- Ageing visualization: horizontal bar split into 4 colored segments (current/30/60/90+ days)
- Payment history table: date, invoice #, amount, method, status
- Total outstanding + oldest invoice callout

Visits tab:
- Timeline of salesman visits: date, salesman name, purpose, orders placed, collection amount, notes

AI Insights tab:
- Card: "AI Analysis of [Customer Name]"
- Stub content (hardcoded realistic text for now):
  - Purchase pattern analysis
  - Payment behavior summary
  - Risk indicators
  - Recommendations (credit limit suggestion, product recommendations)
- "Refresh Analysis" button

---

## STEP 9 — Payments Pages

### app/(dashboard)/payments/page.tsx — Outstanding Overview

Header: "Payments & Collections"

Top summary cards:
- Total Outstanding: ₹X (large, red-tinted)
- Collected This Month: ₹X (green)
- Overdue (30+ days): ₹X + count
- Average Collection Days: X days

Ageing chart: Horizontal stacked bar showing distribution across 0-30 / 31-60 / 61-90 / 90+ days (use Recharts BarChart)

Outstanding table:
Columns: Customer | Phone | Outstanding | 0-30 | 31-60 | 61-90 | 90+ | Score | Last Payment | Actions
- Row color: white if current, light yellow if overdue, light red if 60+ days
- Actions: Send Payment Link | Record Payment | View Customer | WhatsApp

### app/(dashboard)/payments/collections/page.tsx — Collection Plan

Header: "Today's Collection Plan" + date

AI priority strip at top: "Based on payment scores and overdue amounts, focus on these customers today."

Priority list (ranked cards, not a table):
Each card:
- Rank number (large, in circle)
- Customer name + city + phone
- Outstanding amount (large)
- Days overdue (colored pill)
- Payment score ring
- Last payment date
- Quick actions: WhatsApp | Send Link | Record Payment
- Priority score explanation: "High priority: ₹45,000 overdue 23 days, declining payment score"

---

## STEP 10 — Field Force Pages

### app/(dashboard)/field/page.tsx — Field Overview

Header: "Field Force"

Top KPIs: Active Salesmen | Visits Today | Orders Today | Collections Today

Live status grid (cards per salesman):
- Avatar + name + territory
- Today's status: Check-in time | Current location (last known) | Visits done/planned | Orders placed | Collections
- Color-coded: green if active, grey if not checked in, yellow if checked in but no visits

### app/(dashboard)/field/salesmen/page.tsx — Salesman List

Table: Name | Territory | Target | Achievement | Achievement% | Visits Today | Status

### app/(dashboard)/field/routes/page.tsx — Route Management

List of routes with: Route name | Salesman | Day | Customer count | Last run date
"Create Route" button → form: route name, salesman, day, add customers (multi-select with drag-to-reorder sequence)

### app/(dashboard)/field/visits/page.tsx — Visit Log

Filterable table: Date | Salesman | Customer | Check-in | Check-out | Duration | Orders | Collection | Purpose

---

## STEP 11 — Analytics Pages

### app/(dashboard)/analytics/page.tsx — Report Builder

Header: "Analytics & Reports"

Tabs: Sales | Inventory | Collections | Custom

Sales tab:
- Date range picker (default: this month)
- Group by selector: Day | Week | Month | Product | Customer | Salesman | Category
- Recharts BarChart or LineChart (toggle)
- Summary table below chart with the grouped data
- Export to Excel button → POST /api/v1/analytics/export (show toast "Export will be emailed to you")

Inventory tab:
- Category-wise breakdown: donut chart of value distribution by category
- Top 10 products by value table
- Dead stock table: products with no movement in 30 days

Collections tab:
- Collection rate trend: line chart by month
- Salesman collection performance: bar chart (target vs actual)
- Ageing distribution donut chart

Custom tab:
- "Coming in next update" placeholder with illustration

---

## STEP 12 — Suppliers & Purchase Orders Pages

### app/(dashboard)/suppliers/page.tsx — Supplier List
Standard table with: Name | City | Phone | Lead Time | Performance Score | Open POs | Actions

### app/(dashboard)/suppliers/[id]/page.tsx — Supplier Detail
Info + purchase order history + performance score trend

### app/(dashboard)/purchase-orders/page.tsx — PO List
Table: PO # | Supplier | Date | Expected | Status | Amount | Actions

### app/(dashboard)/purchase-orders/new/page.tsx — Create PO
Select supplier → add products with quantities and prices → confirm

### app/(dashboard)/purchase-orders/[id]/page.tsx — PO Detail
Status timeline + items + "Receive Stock" button
Receive Stock: opens modal per item to enter received quantity + batch info

---

## STEP 13 — Settings Pages

### app/(dashboard)/settings/page.tsx — Org Settings
Tabs: General | GST & Invoicing | Notifications | Integrations | Billing

General tab:
- Org name, phone, email, address fields
- Logo upload (image preview)
- Timezone, language, financial year start

GST & Invoicing tab:
- Invoice prefix, order prefix
- Auto-invoice on dispatch toggle
- Payment reminder days (checkbox: 3 days / 7 days / 15 days / 30 days)
- Daily briefing time picker

Notifications tab:
- Toggle switches: WhatsApp briefing | Payment reminders | Low stock alerts | New order alerts

Integrations tab:
- WhatsApp Business API: phone number, token fields + connection status indicator
- Razorpay: key ID, key secret fields + test connection button
- Tally: download bridge button + setup instructions
- All shown as "connection cards" with status (Connected/Not configured)

Billing tab:
- Current plan card: plan name, status, expires date, features list
- Usage meters: Invoices this month (X/100 for FREE), AI queries (X/10), Users (X/1)
- Upgrade plan section: 3 plan cards (Starter/Growth/Enterprise) with features + price + "Upgrade" button
- Cancel subscription link

### app/(dashboard)/settings/users/page.tsx — User Management
Table of org users + invite form
Each row: avatar, name, email, role (editable dropdown), status badge, remove button

---

## STEP 14 — DistroAI Chat Page

### app/(dashboard)/ai/page.tsx

Full-page two-panel layout:

Left panel (280px, fixed):
- "DistroAI" header with AI icon
- Conversation history list (stub: show 5 example past conversations with truncated first message)
- "New Chat" button at top
- Example prompts section at bottom: 4 clickable example queries:
  - "Which products will stock out this week?"
  - "Show me top 5 defaulters"
  - "Compare sales this vs last month"
  - "Collection plan for today"

Right panel (main):
When no message: centered welcome state:
- Large greeting: "Ask me anything about your business"
- 4 example prompt cards in 2x2 grid (same as left panel)

When chat active: message thread
- User messages: right-aligned, gold background
- AI messages: left-aligned, dark card background with AI icon
- AI messages support markdown rendering (use react-markdown)
- If AI response contains chart data: render inline Recharts chart inside the message bubble
- Typing indicator: 3 animated dots while waiting for response
- Scroll to bottom on new message

Bottom input bar:
- Textarea (auto-resize, max 120px height)
- Voice button (microphone icon) — opens browser microphone, stub for now
- Send button (disabled if empty)
- On submit: POST /api/v1/ai/query → show response
- For now: if backend AI is not configured, show realistic stub responses

---

## STEP 15 — Shared Components Library

Build all these in apps/web/components/. Use them consistently across all pages.

### Data Display
- KPICard: metric, label, trend (up/down + %), sparkline, secondary stat, accent color prop
- PaymentScoreRing: SVG circular progress, colored by score band, number in center, size prop
- StatusBadge: pill with color by status value, status→color map as prop
- AgeingBar: horizontal stacked bar, 4 segments with colors and tooltips
- MiniSparkline: small Recharts LineChart, no axes, just the line with gradient fill

### Tables & Lists
- DataTable: TanStack Table wrapper with sorting, filtering, pagination, export button, loading skeleton, empty state
- AlertCard: icon + type color + message + time ago + action button

### Forms & Inputs
- SearchInput: debounced input with loading indicator, clear button
- DateRangePicker: start/end date, presets (Today/7D/30D/This Month/Last Month/Custom)
- CustomerSearch: async autocomplete hitting /api/v1/customers?search=
- ProductSearch: async autocomplete hitting /api/v1/products?search=
- IndianStateSelect: dropdown of all 28 states + 8 UTs
- AmountInput: numeric input formatted as Indian currency in real-time, accepts ₹ prefix

### Feedback
- LoadingSkeleton: pulse animation, height and width as props
- EmptyState: illustration (SVG inline), title, description, optional CTA button
- ConfirmModal: title, description, confirm button (configurable color), cancel button
- Toast: use react-hot-toast with custom styling matching design system

### Layout
- PageHeader: title, breadcrumb, right-side action buttons slot
- SummaryStrip: horizontal row of metric cards above main content
- TwoColumnLayout: 60/40 or 70/30 split with responsive stack on mobile

---

## STEP 16 — API Hooks (TanStack Query)

Create hooks in apps/web/hooks/. Every API call must go through these hooks.

```typescript
// Pattern for every resource:
export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => apiClient.get('/api/v1/orders', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderDto) => apiClient.post('/api/v1/orders', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] });
      toast.success('Order created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
}
```

Build hooks for: auth, users, products, inventory, customers, suppliers, orders, invoices, payments, purchaseOrders, analytics, field (salesmen, routes, visits), ai, org/settings, notifications.

---

## STEP 17 — PWA Configuration

Configure next-pwa:
- manifest.json: name "DistroAI", short_name "DistroAI", theme_color "#07070E", background_color "#07070E", icons at 192x192 and 512x512 (generate placeholder SVG icons)
- Service worker: cache API responses for 5 minutes, cache static assets forever
- Offline page: simple "You are offline. Data shown may be outdated." message
- Install prompt: show "Add to Home Screen" banner after 3 visits

---

## STEP 18 — Testing

Write Playwright E2E tests for:

1. Auth flow: visit /login → enter credentials → redirected to /dashboard → see KPI cards loaded → logout → redirected to /login

2. Create order flow: navigate to /orders/new → search and select customer → add 2 products → confirm → redirected to order detail → status shows CONFIRMED

3. Invoice flow: navigate to /invoices → click an invoice → see invoice preview → click Record Payment → fill modal → submit → invoice status changes to PAID

4. Navigation: all sidebar links navigate to correct pages without errors

Write React Testing Library unit tests for:
- KPICard renders correct value, trend, and color
- PaymentScoreRing shows correct color band for different score values
- StatusBadge renders correct color for each status
- DataTable renders rows and handles empty state
- AmountInput formats Indian currency correctly

---

## CODE QUALITY STANDARDS

- Zero 'any' types. Use proper TypeScript everywhere.
- All forms use react-hook-form + zod schemas — no uncontrolled inputs
- All async data via TanStack Query hooks — no useEffect for data fetching
- All monetary values through formatCurrency() from @distroai/utils
- All dates through date-fns with 'dd MMM yyyy' format
- No inline styles (except CSS variables). Use Tailwind classes.
- Every page must have: loading state (skeleton), error state (error card with retry), empty state
- All modals use a consistent Modal wrapper component with focus trap
- Mobile-responsive: all pages must work on 375px width minimum

---

## WHAT TO DELIVER

At end of Phase 3:

1. apps/web/ — complete Next.js 14 application
2. All 14 feature pages fully built and connected to the API
3. All 15+ shared components in apps/web/components/
4. All API hooks in apps/web/hooks/
5. PWA manifest and service worker configured
6. Playwright E2E tests passing
7. React Testing Library component tests passing
8. README update: how to run web locally, env vars needed

Do NOT build:
- WhatsApp bot (Phase 4)
- Real AI responses — stub them with realistic hardcoded data
- Real PDF generation — show preview only
- Real email/SMS sending
- React Native mobile app (Phase 6)

Build everything else completely, with production-quality UI.
