# Phase 4: Integrations — WhatsApp Bot, PDF, Queues, Payments, Notifications

Phases 1–3 are complete:
- Monorepo with Turborepo, shared packages, Docker (Postgres 5433, Redis 6380)
- Full NestJS backend: 17 modules, 68 files, 9/9 unit tests
- Full Next.js frontend: 14 pages, 12/12 Jest tests, TypeScript clean

Now build Phase 4: all real integrations. Replace every stub and console.log with production implementations.

---

## CONTEXT

- All stubs live in apps/api/src/notifications/notification.service.ts — replace them
- WhatsApp webhook handler already has routes in apps/api/src/whatsapp/ — implement the logic
- Invoice PDF endpoint already exists at POST /api/v1/invoices/:id/pdf — implement the generation
- BullMQ is already a dependency — wire up the queues
- Environment variables are defined in apps/api/.env.example — add new ones

---

## STEP 1 — BullMQ Queue Infrastructure

Create apps/api/src/queue/ module.

### QueueModule (global)
Register these BullMQ queues with Redis connection from REDIS_URL:
- `notification` — all outbound messages (WhatsApp, SMS, email, push)
- `invoice` — PDF generation, e-invoice push, send invoice
- `ai` — demand forecasting, payment score recalc, owner briefing generation
- `payment-reminder` — daily overdue payment reminders
- `report` — async Excel/PDF report exports
- `sync` — Tally sync

### Queue configuration
- All queues: defaultJobOptions { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
- On job failure after all retries: move to dead-letter (use BullMQ's failedReason)
- Log every job start, completion, and failure to console with job ID and queue name
- Expose QueueService with methods: addToQueue(queueName, jobName, data, options?)

### Bull Board (job monitoring UI)
Install @bull-board/api + @bull-board/nestjs.
Mount at /admin/queues (protect with a basic API key header check: X-Admin-Key must match ADMIN_KEY env var).
This gives a visual UI to see all queues, job counts, and retry failed jobs.

---

## STEP 2 — WhatsApp Business API Integration

### Configuration
Install: @nestjs/axios, node-fetch
Required env vars:
- WHATSAPP_API_URL (e.g. https://graph.facebook.com/v19.0)
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_WEBHOOK_SECRET

### WhatsApp Service (apps/api/src/whatsapp/whatsapp.service.ts)

Implement these methods using Meta WhatsApp Business API:

```typescript
// Send a simple text message
sendText(to: string, body: string): Promise<void>

// Send an interactive button message (up to 3 buttons)
sendButtons(to: string, body: string, buttons: Array<{ id: string, title: string }>): Promise<void>

// Send an interactive list message (for product catalogues)
sendList(to: string, header: string, body: string, buttonText: string, sections: Array<{ title: string, rows: Array<{ id: string, title: string, description?: string }> }>): Promise<void>

// Send a document (invoice PDF)
sendDocument(to: string, documentUrl: string, filename: string, caption?: string): Promise<void>

// Send a template message (for payment reminders — requires pre-approved templates)
sendTemplate(to: string, templateName: string, languageCode: string, components?: any[]): Promise<void>

// Mark incoming message as read
markRead(messageId: string): Promise<void>
```

All methods: call Meta API, handle errors gracefully (log + don't throw — WhatsApp failures should never crash the main flow).

### Webhook Handler (apps/api/src/whatsapp/whatsapp.webhook.ts)

GET /api/v1/whatsapp/webhook — already exists, verify hub.challenge.

POST /api/v1/whatsapp/webhook:
1. Verify X-Hub-Signature-256 header using HMAC-SHA256 with WHATSAPP_WEBHOOK_SECRET
2. Parse the webhook payload (Meta sends nested structure — extract messages array)
3. For each message: find the org by phoneNumberId, route to WhatsApp Bot Handler
4. Always return HTTP 200 immediately (Meta will retry if non-200)

### WhatsApp Bot — State Machine (apps/api/src/whatsapp/bot.handler.ts)

This is the core of the WhatsApp product. Implement a complete conversation state machine.

Session management: read/write WhatsAppSession from DB (state + context JSON).
Every incoming message: load session → process → update session → send response.

**FLOW 1: ORDER PLACEMENT (retailer → distributor)**

Trigger: incoming message contains "order", "order karni hai", "order chahiye", "mujhe order dena hai" (case-insensitive, detect Hindi keywords)

```
State: IDLE
  → detect order intent
  → send: "Welcome! What would you like to do?" [buttons: Place Order | Check Balance | Track Order]
  → state: MAIN_MENU

State: MAIN_MENU
  button "Place Order" clicked
  → fetch org's active products (top 20 by recent order frequency)
  → send list message: sections by category, each row = product name + price
  → state: ORDER_PRODUCT_SELECT
  → context: { items: [] }

State: ORDER_PRODUCT_SELECT
  user selects a product from list
  → send: "How many [Product Name]? (Current price: ₹X per [unit])" [buttons: 1 | 5 | 10 | Enter quantity]
  → if "Enter quantity": ask for text input
  → state: ORDER_QTY_INPUT
  → context: { ...context, currentProduct: { productId, name, price } }

State: ORDER_QTY_INPUT
  user sends a number
  → validate it's a positive integer
  → add to context.items: { productId, name, qty, price, total }
  → send order so far + "Add more items?" [buttons: Add More | Confirm Order | Cancel]
  → state: ORDER_ADD_MORE

State: ORDER_ADD_MORE
  "Add More" → go back to ORDER_PRODUCT_SELECT (preserve items in context)
  "Confirm Order" → go to ORDER_CONFIRM
  "Cancel" → clear context, state: IDLE, send "Order cancelled."

State: ORDER_CONFIRM
  → calculate total from context.items
  → send order summary:
    "📦 Order Summary:
    • Product A x5 — ₹500
    • Product B x2 — ₹300
    Total: ₹800 + GST
    Confirm?" [buttons: Yes, Confirm | No, Cancel]
  → state: ORDER_AWAITING_CONFIRM

State: ORDER_AWAITING_CONFIRM
  "Yes, Confirm"
  → create Order in DB (source: WHATSAPP, status: CONFIRMED)
  → send: "✅ Order #ORD-2025-00123 confirmed! Expected delivery: [date]. We'll notify you when dispatched."
  → notify org owner: queue push notification + WhatsApp to owner
  → state: IDLE, clear context

  "No, Cancel"
  → state: IDLE, clear context, "Order cancelled. Type 'order' anytime to start again."
```

**FLOW 2: BALANCE CHECK**

```
State: MAIN_MENU
  button "Check Balance" clicked
  → find customer by WhatsApp phone number in Customers table
  → if not found: "We couldn't find your account. Please contact your distributor."
  → if found:
    "💰 Your Account:
    Outstanding: ₹X
    Last payment: ₹Y on DD MMM YYYY
    Oldest invoice: #INV-XXX due DD MMM YYYY"
  → if outstanding > 0: append payment link button
  → state: IDLE
```

**FLOW 3: ORDER TRACKING**

```
State: MAIN_MENU
  button "Track Order" clicked
  → send: "Enter your order number (e.g. ORD-2025-00123)"
  → state: ORDER_TRACK_INPUT

State: ORDER_TRACK_INPUT
  user sends text
  → look up order by orderNumber + match to customer phone
  → if found: "📦 Order #X Status: [status emoji + name]\nItems: ...\n[delivery info]"
  → if not found: "Order not found. Please check the order number."
  → state: IDLE
```

**FLOW 4: VOICE ORDER**

```
Incoming message type = audio
  → download audio file from WhatsApp media URL
  → transcribe using OpenAI Whisper API (language: auto-detect, hint: 'hi' for Hindi)
  → pass transcript to GPT-4o with system prompt:
    "Extract order items from this text. Return JSON: { items: [{ productName: string, quantity: number }] }
     The user is a retailer placing an order with their distributor. Match product names loosely."
  → match extracted productNames to org's product catalog (fuzzy match using Levenshtein distance)
  → if items found: send ORDER_CONFIRM flow with matched items
  → if nothing matched: "Sorry, I couldn't understand your order. Please type your order or use the menu."
```

**FLOW 5: PAYMENT LINK (outbound — triggered from web dashboard)**

This is triggered by the distributor clicking "Send Payment Link" in the web app, NOT by an incoming message.

POST /api/v1/whatsapp/send-payment-request body: { customerId, invoiceId?, orgId }
→ fetch customer's outstanding amount (or specific invoice amount)
→ create Razorpay payment link (see Step 3)
→ send WhatsApp message to customer.whatsappNumber:
  "Hi [name], 
   Payment of ₹[amount] is due for [org name].
   Invoice: #[number] | Due: [date]
   Pay securely here: [razorpay link]
   
   Thank you! 🙏"
→ update Invoice.paymentLinkUrl in DB

**FLOW 6: OWNER DAILY BRIEFING (automated — triggered by cron)**

This is sent TO the owner, not from a customer.
Triggered by ai-queue job 'generate-briefing' (see Step 6).
Send to all OWNER + ADMIN users who have whatsappNumber set.

Message format:
```
🌅 Good morning [name]!

📊 Yesterday's Summary:
• Revenue: ₹X (↑Y% vs day before)
• Orders: N delivered
• Collections: ₹X received

⚠️ Action Needed:
• [N] products low on stock
• [N] overdue payments (₹X total)
• [N] customers not ordered in 30+ days

🎯 Top Priority Today:
1. Collect from [Customer] — ₹X overdue [N] days
2. Reorder [Product] — only [N] units left
3. [Dormant customer] hasn't ordered in [N] days

Type anything to reply or visit app.distroai.in
```

Fetch all data for this message from DB queries — no AI API call needed for the briefing itself (use real data).

**FLOW 7: PAYMENT REMINDER (automated — triggered by cron)**

Triggered by payment-reminder queue. Send to customer.whatsappNumber.

Day 3 reminder:
"Hi [name], this is a friendly reminder that Invoice #[X] for ₹[amount] from [org name] is due. 
Pay here: [link] 🙏"

Day 7 reminder:
"Hi [name], Invoice #[X] for ₹[amount] is now 7 days overdue. Please pay at your earliest convenience.
Pay here: [link]"

Day 15 reminder:
"Hi [name], Invoice #[X] for ₹[amount] has been outstanding for 15 days. Please clear this balance immediately to maintain your credit limit.
Pay here: [link]
Contact: [owner phone]"

---

## STEP 3 — Razorpay Integration

Required env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

Install: razorpay

### RazorpayService (apps/api/src/payments/razorpay.service.ts)

```typescript
// Create a payment link
createPaymentLink(params: {
  amount: number,        // in paise (multiply ₹ by 100)
  currency: 'INR',
  description: string,
  customerName: string,
  customerPhone: string,
  customerEmail?: string,
  referenceId: string,   // invoiceId
  expiryDate?: Date,
  notifyWhatsapp?: boolean,
  notifySms?: boolean,
  notifyEmail?: boolean,
}): Promise<{ id: string, shortUrl: string }>

// Create a standard order (for checkout integration)
createOrder(amount: number, currency: string, receipt: string): Promise<{ id: string }>

// Verify payment signature
verifyWebhookSignature(payload: string, signature: string): boolean

// Fetch payment details
fetchPayment(paymentId: string): Promise<RazorpayPayment>
```

### Update Webhook Handler
The Razorpay webhook is already at POST /api/v1/payments/razorpay-webhook — update it to:
1. Verify signature using RazorpayService.verifyWebhookSignature()
2. Handle `payment.captured`:
   - Find Invoice by razorpayOrderId or referenceId
   - Run in Prisma transaction: create Payment record (status: COMPLETED), update Invoice.paidAmount + balanceAmount + status, update Customer.outstandingAmount
   - Trigger PaymentScoreService.recalculate(customerId)
   - Queue: send WhatsApp receipt to customer
3. Handle `payment.failed`:
   - Update Payment status to FAILED
   - Queue: notify owner
4. Handle `payment_link.paid`:
   - Same as payment.captured but source is payment link

### Payment Receipt (sent after successful payment)
```
✅ Payment Received!

Amount: ₹[X]
Invoice: #[number]
Date: [today]
From: [customer name]
To: [org name]

Balance: ₹[remaining] [if 0: "Account cleared! 🎉"]

Thank you for your prompt payment! 🙏
```

---

## STEP 4 — Invoice PDF Generation

Install: @react-pdf/renderer, @types/react-pdf

### InvoicePdfService (apps/api/src/invoices/invoice-pdf.service.ts)

Implement generateInvoicePdf(invoiceId: string): Promise<string> — returns S3 URL.

Steps:
1. Fetch invoice with all relations (items + products, customer, org + settings)
2. Render to PDF using @react-pdf/renderer (server-side, not browser)
3. Upload to S3 at key: invoices/{orgId}/{invoiceId}.pdf
4. Update Invoice.pdfUrl in DB
5. Return the S3 URL (use signed URL with 7-day expiry)

### PDF Layout (implement as @react-pdf/renderer Document)

The PDF must be legally valid for Indian GST invoices. Layout:

**Header section:**
- Left: Org logo (if set, fetch from S3), org name (bold, 16pt), address, city state pincode, GSTIN, Phone
- Right: "TAX INVOICE" (large, bold), Invoice #, Invoice Date, Due Date, Place of Supply (state + state code)

**Customer section (two boxes side by side):**
- "Bill To": customer name, address, GSTIN (if set), phone
- "Ship To": same as Bill To (or delivery address if different)

**Items table:**
Headers: #, Description, HSN/SAC, Qty, Unit, Rate, Discount, Taxable Amt, CGST%, CGST Amt, SGST%, SGST Amt, IGST%, IGST Amt, Total
- For inter-state (IGST): hide CGST/SGST columns, show IGST columns
- For intra-state (CGST+SGST): hide IGST column
- Alternating row background: white and #f9f9f9
- All amounts right-aligned, in Indian number format

**Totals section (right-aligned box):**
- Subtotal
- Total Discount (if any)
- Taxable Amount
- CGST total (if intra-state)
- SGST total (if intra-state)
- IGST total (if inter-state)
- Cess total (if any)
- Round Off
- **Grand Total** (bold, larger font)
- Amount in Words: "Rupees One Lakh Twenty Three Thousand Four Hundred and Fifty Six Only"

**Footer section:**
- Left: Bank details (bank name, account number, IFSC, branch) — from org settings
- Center: UPI ID — from org settings  
- Right: QR code (use react-qr-code rendered as SVG, embed in PDF) linking to payment page
- Bottom strip: "This is a computer generated invoice. Signature not required." centered
- If e-invoice: show IRN number and e-invoice QR code

### Amount in Words (Indian format)
Implement indianAmountToWords(amount: number): string
Must handle: lakhs, crores correctly.
Example: 1,23,456.50 → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Paise Fifty Only"

### Wire up the invoice queue worker:
When job 'generate-pdf' arrives in invoice queue:
→ call InvoicePdfService.generateInvoicePdf(invoiceId)
→ on success: if invoice has customer.whatsappNumber and org has whatsapp configured → queue send-invoice job
→ log completion

---

## STEP 5 — AWS S3 File Storage

Install: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

Required env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME

### S3Service (apps/api/src/storage/s3.service.ts)

```typescript
// Upload a buffer/stream to S3
upload(key: string, buffer: Buffer, contentType: string): Promise<string>  // returns public URL or key

// Generate a signed URL for reading a private file
getSignedUrl(key: string, expiresInSeconds: number): Promise<string>

// Delete a file
delete(key: string): Promise<void>

// Upload from a URL (download then re-upload) — used for WhatsApp media
uploadFromUrl(sourceUrl: string, destKey: string): Promise<string>
```

Key naming conventions:
- Invoices: `invoices/{orgId}/{invoiceId}.pdf`
- Logos: `logos/{orgId}/logo.{ext}`
- Shelf audits: `audits/{orgId}/{auditId}/{timestamp}.jpg`
- Salesman selfies: `attendance/{orgId}/{salesmanId}/{date}.jpg`

If AWS is not configured (no AWS_ACCESS_KEY_ID): fall back to local filesystem storage at /tmp/distroai-uploads/ and return a local URL. Log a warning that S3 is not configured.

---

## STEP 6 — Scheduled Jobs & Cron Tasks

### Daily Briefing Cron (runs at 7:45 AM IST daily)
```typescript
@Cron('45 7 * * *', { timeZone: 'Asia/Kolkata' })
async generateDailyBriefings() {
  // Find all active orgs with at least one OWNER/ADMIN who has whatsappNumber set
  // For each org: add job to ai-queue: { name: 'generate-briefing', data: { orgId } }
}
```

AI queue worker for 'generate-briefing':
1. Fetch yesterday's data: total revenue, order count, collection amount
2. Fetch alerts: low stock products (count), overdue invoices (count + total), dormant customers (count)
3. Fetch collection priorities: top 3 customers to collect from today
4. Fetch reorder priorities: top 2 products to reorder
5. Format the briefing message (template from Step 2, Flow 6)
6. For each OWNER/ADMIN with whatsappNumber: queue WhatsApp send
7. Also save as a Notification record for in-app display

### Payment Reminder Cron (runs at 10:00 AM IST daily)
```typescript
@Cron('0 10 * * *', { timeZone: 'Asia/Kolkata' })
async sendPaymentReminders() {
  const today = new Date();
  // Find invoices that are exactly 3, 7, or 15 days overdue
  // For each: add job to payment-reminder queue
}
```

Payment reminder queue worker:
1. Fetch invoice + customer + org
2. Ensure customer has whatsappNumber and org has WhatsApp configured
3. Ensure reminder hasn't already been sent today (check Notification table)
4. Send appropriate reminder (day 3/7/15 templates from Step 2, Flow 7)
5. If day >= 15: also flag customer with low priority warning (log for now)
6. Create Notification record to track this reminder was sent

### Demand Forecast Cron (runs at 2:00 AM IST daily)
```typescript
@Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })
async runDemandForecasts() {
  // For each active org: get all active products
  // For each product with at least 30 days of order history: add to ai-queue
}
```

AI queue worker for 'run-forecast':
- Call Python ai-service at AI_SERVICE_URL/forecast/run
- If ai-service not available: use simple 30-day moving average fallback (implement in TypeScript)
- Store results in DemandForecast table (upsert by orgId + productId + forecastDate)
- If product stock <= reorder point from forecast: create a low-stock Notification

### Payment Score Recalculation (runs at 6:00 AM IST daily)
```typescript
@Cron('0 6 * * *', { timeZone: 'Asia/Kolkata' })
async recalculatePaymentScores() {
  // For each active org: queue payment score recalc for all customers
}
```

AI queue worker for 'compute-payment-scores':
- For each customer: fetch last 6 months of payments
- Run scoring algorithm (already implemented in Phase 2)
- If score changed: update Customer.paymentScore, create PaymentScoreLog entry
- If score dropped below 40 (RED band): create urgent Notification for owner

### Weekly Digest (runs every Monday at 9:00 AM IST)
```typescript
@Cron('0 9 * * 1', { timeZone: 'Asia/Kolkata' })
async sendWeeklyDigests() {
  // Generate weekly summary for each org and send via WhatsApp to OWNER users
}
```

---

## STEP 7 — Email Integration (Resend)

Install: resend

Required env var: RESEND_API_KEY, FROM_EMAIL (e.g. noreply@distroai.in)

### EmailService (apps/api/src/notifications/email.service.ts)

```typescript
sendInvoice(to: string, invoicePdfUrl: string, invoiceNumber: string, amount: number, orgName: string): Promise<void>

sendPaymentReminder(to: string, customerName: string, invoiceNumber: string, amount: number, dueDate: Date, paymentLink: string, orgName: string): Promise<void>

sendWelcome(to: string, firstName: string, orgName: string, tempPassword?: string): Promise<void>

sendOTP(to: string, otp: string): Promise<void>

sendWeeklyDigest(to: string, firstName: string, data: WeeklyDigestData): Promise<void>
```

All emails: use Resend's React Email templates (install @react-email/components).
Create simple HTML email templates for each. Match the dark DistroAI design where possible.
If RESEND_API_KEY is not set: log the email content to console (development fallback).

---

## STEP 8 — SMS Integration (MSG91)

Install: axios (already installed)

Required env vars: MSG91_AUTH_KEY, MSG91_SENDER_ID (default: DISTRO)

### SMSService (apps/api/src/notifications/sms.service.ts)

```typescript
sendOTP(phone: string, otp: string): Promise<void>

sendPaymentReminder(phone: string, customerName: string, amount: number, paymentLink: string): Promise<void>

sendOrderConfirmation(phone: string, customerName: string, orderNumber: string, amount: number): Promise<void>

sendDeliveryNotification(phone: string, customerName: string, orderNumber: string): Promise<void>
```

Use MSG91's Flow API for OTP, transactional API for others.
If MSG91_AUTH_KEY not set: log to console.

---

## STEP 9 — Push Notifications (Firebase FCM)

Install: firebase-admin

Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

### PushService (apps/api/src/notifications/push.service.ts)

```typescript
sendToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void>
// Fetches user.fcmTokens, sends to all tokens, removes invalid tokens

sendToOrg(orgId: string, roles: UserRole[], title: string, body: string, data?: Record<string, string>): Promise<void>
// Sends to all users in org with matching roles
```

Notification categories (use data.type for frontend routing):
- `new_order` — data: { orderId }
- `payment_received` — data: { paymentId, invoiceId }
- `low_stock` — data: { productId }
- `overdue_payment` — data: { customerId, invoiceId }
- `salesman_checkin` — data: { salesmanId }

If Firebase not configured: log to console.

---

## STEP 10 — Notification Service (Wire Up Everything)

Update NotificationService to replace all console.log stubs:

```typescript
async notify(orgId: string, event: NotificationEvent): Promise<void> {
  // 1. Create Notification record in DB (always)
  // 2. Based on event type and org settings, queue appropriate channels:
  //    - Add to notification queue: 'send-whatsapp', 'send-sms', 'send-email', 'send-push'
}
```

Notification queue workers:
- Worker 'send-whatsapp': call WhatsAppService.sendText/sendButtons/sendDocument
- Worker 'send-sms': call SMSService
- Worker 'send-email': call EmailService
- Worker 'send-push': call PushService

Notification events to implement:
```typescript
type NotificationEvent =
  | { type: 'NEW_WHATSAPP_ORDER'; orderId: string; customerId: string }
  | { type: 'ORDER_STATUS_CHANGED'; orderId: string; newStatus: OrderStatus; customerId: string }
  | { type: 'INVOICE_CREATED'; invoiceId: string; customerId: string }
  | { type: 'PAYMENT_RECEIVED'; paymentId: string; customerId: string; amount: number }
  | { type: 'PAYMENT_OVERDUE'; invoiceId: string; customerId: string; daysOverdue: number }
  | { type: 'LOW_STOCK'; productId: string; currentQty: number; minQty: number }
  | { type: 'SALESMAN_CHECKIN'; salesmanId: string; customerId: string }
  | { type: 'DAILY_BRIEFING'; briefingMessage: string; targetUserIds: string[] }
  | { type: 'USER_INVITED'; userId: string; tempPassword: string }
```

---

## STEP 11 — GST E-Invoice Integration (GSTN Sandbox)

Required env vars: NIC_EINVOICE_USERNAME, NIC_EINVOICE_PASSWORD, NIC_EINVOICE_URL (sandbox first)

### EInvoiceService (apps/api/src/invoices/einvoice.service.ts)

Implement the full NIC IRP e-invoice API flow:

```typescript
// Step 1: Authenticate with NIC IRP
authenticate(): Promise<string>  // returns session token (cache for 6 hours)

// Step 2: Generate IRN for an invoice
generateIRN(invoiceId: string): Promise<{
  irn: string,
  ackNo: string,
  ackDate: string,
  signedQRCode: string,
  signedInvoice: string
}>

// Step 3: Cancel an IRN (if invoice is cancelled)
cancelIRN(irn: string, cancelReason: string): Promise<void>

// Step 4: Get e-invoice by IRN
getByIRN(irn: string): Promise<EInvoiceDetails>
```

The generateIRN method must:
1. Authenticate (use cached token)
2. Build the NIC e-invoice JSON payload from Invoice data (follow GST e-invoice schema exactly)
3. POST to NIC IRP /irngeneration endpoint
4. On success: update Invoice.eInvoiceIrn + store signedQRCode
5. Re-generate PDF with IRN embedded (queue PDF regeneration)

NIC e-invoice JSON structure (implement fully):
- TransDtls: tax schema, supply type, e-commerce GSTIN
- DocDtls: type, number, date
- SellerDtls: org GSTIN, name, address, place, state code, pincode
- BuyerDtls: customer GSTIN (if B2B), name, address, place, state code, pincode
- ItemList: array of items with HSN, quantity, unit, price, GST rates, amounts
- ValDtls: total values

If NIC_EINVOICE_USERNAME not configured: return mock response with dummy IRN for testing.

---

## STEP 12 — Tally Bridge Service

Create a separate Node.js service: apps/tally-bridge/

This runs as a local Windows-compatible service on the distributor's computer.
It polls the DistroAI API for pending sync items and pushes them to Tally Prime.

### Setup
- Express.js server (simple, no NestJS — this is a lightweight desktop tool)
- Polls GET /api/v1/tally/pending-sync every 15 minutes (or on-demand trigger)
- Communicates with Tally Prime via HTTP on localhost:9000 (Tally's built-in XML server)
- Runs as a Windows service via node-windows (or just a tray app stub)

### Tally API Endpoints (add to NestJS API)
```
GET  /api/v1/tally/pending-sync    — returns invoices/payments not yet synced to Tally
POST /api/v1/tally/sync-complete   — marks items as synced
GET  /api/v1/tally/config          — get Tally sync settings (company name, etc.)
POST /api/v1/tally/config          — save Tally sync settings
```

Add to Invoice model: tallyVoucherNumber String?, tallySyncedAt DateTime?
Add to Payment model: tallyReceiptNumber String?, tallySyncedAt DateTime?

### XML Generation
```typescript
function invoiceToTallyXML(invoice: InvoiceWithRelations): string
function paymentToTallyXML(payment: PaymentWithRelations): string
```

Both functions generate valid Tally XML for Sales Voucher and Receipt Voucher types.
Include all ledger entries, GST classifications, and party names.

The Tally bridge is a stub/scaffold for now — the key deliverable is the XML generator and the API endpoints. The actual Windows service packaging can be done later.

---

## STEP 13 — Update Frontend for Real Integrations

Update apps/web/ to wire up the new real endpoints:

### Invoice Page Updates
- "Generate PDF" button: POST /api/v1/invoices/:id/pdf → poll for completion → show download link
- "Send via WhatsApp" button: now actually sends if WhatsApp configured, shows confirmation
- "Send Payment Link" button: creates real Razorpay link, shows URL for copying + WhatsApp send
- "E-Invoice" button: POST /api/v1/invoices/:id/e-invoice → show IRN on success

### Settings > Integrations page updates
Replace placeholders with real connection forms:

**WhatsApp Business API card:**
- Fields: Phone Number ID, Access Token, Webhook URL (auto-generated, copy button)
- "Test Connection" button: sends test WhatsApp message to owner's phone
- Status: Connected (green) / Not configured (grey)

**Razorpay card:**
- Fields: Key ID, Key Secret (masked)
- "Test Connection" button: creates a ₹1 test payment link
- Status indicator

**E-Invoice (NIC) card:**
- Fields: Username, Password
- Note: "Required for turnover above ₹5Cr. Test in sandbox first."

**Bull Board link:**
- "View Job Monitor" button → opens /admin/queues in new tab

### Notification Bell (topbar)
Wire up to GET /api/v1/notifications:
- Show real unread count badge
- Dropdown: list of recent notifications with type icons and time ago
- "Mark all read" button
- Click notification → navigate to relevant entity

---

## STEP 14 — Environment Variables

Add all new env vars to apps/api/.env.example:

```env
# Queue
ADMIN_KEY=your-admin-key-for-bull-board

# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v19.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_SECRET=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=distroai-dev

# AI Service
AI_SERVICE_URL=http://localhost:8000

# Email
RESEND_API_KEY=
FROM_EMAIL=noreply@distroai.in

# SMS
MSG91_AUTH_KEY=
MSG91_SENDER_ID=DISTRO

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# GST E-Invoice
NIC_EINVOICE_URL=https://einv-apisandbox.nic.in
NIC_EINVOICE_USERNAME=
NIC_EINVOICE_PASSWORD=
```

---

## STEP 15 — Testing Phase 4

Write tests for:

Unit tests:
- WhatsApp bot state machine: test each state transition with mock messages
- Razorpay webhook: verify HMAC signature validation rejects tampered payloads
- Invoice PDF: test indianAmountToWords for values: 0, 100, 1000, 100000, 10000000, 12345678.50
- Tally XML: test invoiceToTallyXML generates valid XML structure
- Payment score: already tested in Phase 2 — verify it integrates with the cron job

Integration tests:
- POST /api/v1/whatsapp/webhook with valid HMAC → processes message and creates session
- POST /api/v1/whatsapp/webhook with invalid HMAC → returns 401
- POST /api/v1/invoices/:id/pdf → queues PDF job → returns jobId
- POST /api/v1/invoices/:id/payment-link → returns { paymentLinkUrl } (mock Razorpay in test)
- Payment reminder cron: seed overdue invoices at correct day counts → verify correct reminders queued

---

## WHAT TO DELIVER

At end of Phase 4:

1. BullMQ queues running with Bull Board at /admin/queues
2. WhatsApp bot with all 7 flows fully implemented
3. Razorpay: payment link creation + webhook handling working
4. Invoice PDF generation producing legally valid GST invoices
5. S3 file storage (with local fallback)
6. All 4 cron jobs running (briefing, reminders, forecasting, score recalc)
7. Email (Resend), SMS (MSG91), Push (FCM) — fully wired, fall back to console if not configured
8. E-invoice scaffold with NIC API integration (sandbox)
9. Tally bridge scaffold with XML generator
10. Frontend updated: real PDF, real payment links, notification bell wired
11. All new env vars documented in .env.example
12. Tests passing

Do NOT build:
- React Native mobile app (Phase 5)
- AI chat with real LLM (Phase 5)
- Demand forecasting ML model (Phase 5)
- Shelf audit vision AI (Phase 5)

Build everything else to production quality.
