# Phase 6: React Native Mobile App — Salesman Field App

Phases 1–5 are complete:
- Full NestJS backend: 17 modules, all integrations live, 30/30 tests
- Full Next.js dashboard: 14 pages, PWA, streaming AI chat
- WhatsApp bot: 7 flows, DB-persisted sessions
- AI brain: LangChain agent, Prophet forecasting, GPT-4o Vision, pgvector

Now build Phase 6: the React Native salesman mobile app in apps/mobile/.

This app is used exclusively by salesmen in the field. It must work without internet. It must work on cheap Android phones. Every screen must be usable with one hand while standing.

---

## CONTEXT

- Use Expo SDK 51 (managed workflow)
- The API is already fully built — all field endpoints exist: /api/v1/attendance, /api/v1/visits, /api/v1/orders, /api/v1/customers, /api/v1/products, /api/v1/salesmen
- Shared types from @distroai/types — import and use them
- Target: Android 8+ (API 26+) as primary. iOS 14+ secondary.
- APK must be under 30MB — use dynamic imports, avoid heavy libraries

---

## STEP 1 — Expo Project Setup

```
apps/mobile/
  app/                    — Expo Router (file-based routing)
    (auth)/
      login.tsx
    (app)/
      _layout.tsx         — tab navigator
      index.tsx           — home screen
      route.tsx           — today's beat/route
      orders/
        index.tsx
        new.tsx
        [id].tsx
      customers/
        index.tsx
        [id].tsx
      collections.tsx
      performance.tsx
      audit.tsx
  components/             — shared mobile components
  hooks/                  — API hooks + offline hooks
  stores/                 — Zustand stores
  lib/                    — API client, offline queue, sync engine
  assets/                 — icons, splash screen
  app.json                — Expo config
  package.json
```

### Dependencies to install:
```json
{
  "expo": "~51.0.0",
  "expo-router": "~3.5.0",
  "expo-camera": "~15.0.0",
  "expo-location": "~17.0.0",
  "expo-local-authentication": "~14.0.0",
  "expo-barcode-scanner": "~13.0.0",
  "expo-image-picker": "~15.0.0",
  "expo-file-system": "~17.0.0",
  "expo-av": "~14.0.0",
  "expo-haptics": "~13.0.0",
  "expo-notifications": "~0.28.0",
  "expo-background-fetch": "~12.0.0",
  "expo-task-manager": "~11.8.0",
  "@react-native-async-storage/async-storage": "1.23.1",
  "react-native-mmkv": "^2.12.0",
  "zustand": "^4.5.0",
  "@tanstack/react-query": "^5.0.0",
  "react-native-maps": "1.14.0",
  "axios": "^1.6.0",
  "react-native-reanimated": "~3.10.0",
  "react-native-gesture-handler": "~2.16.0",
  "@gorhom/bottom-sheet": "^4.6.0",
  "react-native-safe-area-context": "4.10.1",
  "react-native-screens": "3.31.1",
  "date-fns": "^3.0.0",
  "react-hook-form": "^7.51.0",
  "zod": "^3.23.0"
}
```

### app.json config:
```json
{
  "expo": {
    "name": "DistroAI Field",
    "slug": "distroai-field",
    "version": "1.0.0",
    "orientation": "portrait",
    "backgroundColor": "#07070E",
    "splash": { "backgroundColor": "#07070E" },
    "android": {
      "package": "in.distroai.field",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECORD_AUDIO",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ],
      "adaptiveIcon": { "backgroundColor": "#07070E" }
    }
  }
}
```

---

## STEP 2 — Design System (Mobile)

Create components/ui/theme.ts:

```typescript
export const colors = {
  bg: '#07070E',
  bgCard: '#0F0C1A',
  bgCardHover: '#151222',
  border: 'rgba(255,255,255,0.07)',
  borderAccent: 'rgba(201,168,76,0.3)',

  textPrimary: '#F0E8D5',
  textSecondary: '#9A9080',
  textMuted: '#5A5040',

  gold: '#C9A84C',
  goldLight: '#F5D98B',
  purple: '#7B5EA7',
  orange: '#E07B39',
  green: '#2E8B57',
  greenBright: '#5CC488',
  red: '#E07B60',
  whatsapp: '#25D366',

  success: '#2E8B57',
  warning: '#C9A84C',
  danger: '#E07B60',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 6, md: 10, lg: 14, full: 9999 };
export const fontSize = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 32 };
```

All components use these tokens. No hardcoded color strings anywhere except this file.

---

## STEP 3 — Offline-First Architecture

This is the most critical technical requirement of the whole app. Salesmen work in areas with no internet. Every feature must work offline.

### Offline Queue (lib/offline-queue.ts)

Use react-native-mmkv (fast key-value store, synchronous, works offline):

```typescript
interface QueuedAction {
  id: string;
  type: 'CREATE_ORDER' | 'LOG_VISIT' | 'CHECK_IN' | 'CHECK_OUT' | 'RECORD_COLLECTION';
  payload: any;
  createdAt: string;
  retries: number;
}

// Add action to queue (call when offline or as a reliability layer)
function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>): string

// Process all queued actions (call when back online)
async function processQueue(apiClient: AxiosInstance): Promise<{ processed: number, failed: number }>

// Get all pending actions
function getPendingActions(): QueuedAction[]

// Remove successfully processed action
function dequeue(id: string): void
```

### Local Data Cache (lib/local-cache.ts)

Cache these datasets on login and refresh every 30 minutes:
- Customers assigned to this salesman (full list with contact + GPS)
- Products catalog (name, price, stock level — read-only snapshot)
- Today's route (ordered customer list)
- Org settings (invoice prefix, etc.)

Store in MMKV with keys: `cache:customers`, `cache:products`, `cache:route`, `cache:settings`
Each entry has a `cachedAt` timestamp. Serve from cache if age < 30 minutes.

### Sync Engine (lib/sync-engine.ts)

```typescript
// Called when network connectivity is restored
async function syncOnReconnect(): Promise<SyncResult> {
  // 1. Process offline queue (push local actions to server)
  const queueResult = await processQueue(apiClient);

  // 2. Refresh local cache (pull latest data from server)
  await refreshLocalCache();

  // 3. Return result for UI feedback
  return { pushed: queueResult.processed, failed: queueResult.failed, cacheRefreshed: true };
}
```

Use NetInfo (@react-native-community/netinfo) to detect connectivity changes.
When connectivity restored → automatically trigger syncOnReconnect().
Show a subtle banner: "Back online — syncing X items..." then "All synced ✓"

### Background Sync (Expo Background Fetch)

Register a background task that runs every 15 minutes even when app is closed:
```typescript
TaskManager.defineTask('BACKGROUND_SYNC', async () => {
  if (await NetInfo.fetch().then(s => s.isConnected)) {
    await syncOnReconnect();
  }
  return BackgroundFetch.BackgroundFetchResult.NewData;
});
```

---

## STEP 4 — Auth & API Client

### lib/api-client.ts
Axios instance:
- Base URL from EXPO_PUBLIC_API_URL environment variable
- Request interceptor: attach Authorization: Bearer {accessToken} from MMKV store
- Response interceptor: on 401 → refresh token → retry once → if fails → logout
- Network error: queue the action if it was a mutation (POST/PATCH/DELETE)

### stores/auth.store.ts (Zustand + MMKV persistence)
```typescript
interface AuthState {
  user: User | null;
  org: Org | null;
  salesman: Salesman | null;   // current salesman profile
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}
```

Persist to MMKV so user stays logged in across app restarts.

### app/(auth)/login.tsx

Clean login screen:
- Dark background with DistroAI logo (SVG) centered at top
- Email + password inputs with eye toggle on password
- "Sign In" button (gold, full width)
- On submit: POST /api/v1/auth/login
- On success: fetch salesman profile (GET /api/v1/salesmen — find by userId), store in auth store, navigate to (app)
- Error: show inline error message (red border + text)
- No registration (salesmen are invited by owner via web dashboard)

---

## STEP 5 — Home Screen (app/(app)/index.tsx)

The first thing a salesman sees every morning.

Layout (scrollable):

**Header:**
- "Good morning, [firstName]!" greeting
- Today's date
- Check-in status: if not checked in → "⚠️ Not checked in" (orange) with "Check In Now" button
- If checked in → "✓ Checked in at [time]" (green)

**Today's Targets (horizontal scroll cards):**
- Visits: X done / Y planned
- Orders: X placed / ₹Y value
- Collections: ₹X / ₹Y target
- Each card taps to navigate to relevant section

**Quick Actions (2x2 grid):**
- 📍 Check In (if not done)
- 📦 New Order
- 💰 Record Collection
- 📊 My Performance

**Today's Route Preview:**
- "Your Beat Today" section
- Next 3 customers in route sequence: name, area, last order date
- "View Full Route" button → navigates to route screen
- If route not assigned: "No route assigned for today. Contact your manager."

**Recent Activity Feed:**
- Last 5 actions: visit logged, order placed, collection recorded
- Time ago format

---

## STEP 6 — Route & Beat Screen (app/(app)/route.tsx)

This is the most-used screen during the day.

**Map View (top half):**
- react-native-maps showing all customer pins for today's route
- Pin colors: grey (unvisited), blue (current/next), green (visited), red (skipped)
- User's current GPS location shown as a pulsing blue dot
- Tap pin → show customer name + outstanding + "Navigate" button

**Route List (bottom half, scrollable):**
Each customer card shows:
- Sequence number (large, in colored circle)
- Customer name + area/landmark
- Last order: "X days ago" or "Never ordered"
- Outstanding amount (orange/red if > 0)
- Visit status badge: Pending / Visited / Skipped
- Tap → opens visit flow (bottom sheet)
- "Navigate" button → opens Google Maps / native maps with directions

**Start Visit Bottom Sheet (gorhom/bottom-sheet):**
When customer tapped:
- Customer name + address
- Outstanding: ₹X
- Last order: [date]
- Suggested order: "Last time: Parle-G x10, Maggi x5" (from order history)
- Buttons: "Start Visit" | "Skip (with reason)"
- On "Start Visit" → trigger check-in flow

---

## STEP 7 — Check In / Check Out Flow

### Check In Screen (triggered from Home or Route)

1. Camera opens automatically (front-facing) for selfie capture
   - Use expo-camera
   - Show circular frame overlay ("Take selfie")
   - Capture button at bottom

2. After selfie captured:
   - Get GPS location (expo-location) — show "Getting your location..."
   - If GPS unavailable after 10s: allow manual proceed with warning
   - Show: selfie preview + GPS coordinates on mini map

3. Confirm screen:
   - Time: [current time]
   - Location: [address or coordinates]
   - Selfie: thumbnail
   - "Confirm Check In" button

4. On confirm:
   - POST /api/v1/attendance/check-in with { latitude, longitude, selfieBase64 }
   - If offline: enqueue action, show "Check-in saved. Will sync when online."
   - Navigate back to Home, update check-in status

### Check Out (from Home screen or route completion)
- Show today's summary: visits done, orders placed, collections
- GPS capture
- "Confirm Check Out" → POST /api/v1/attendance/check-out
- Navigate to Performance screen showing today's achievement

### Geofencing validation:
When starting a visit (not the day check-in):
- Compare current GPS to customer.latitude/longitude
- If distance > 200 meters: show warning "You appear to be [X]m away from [Customer Name]. Continue anyway?" [Yes / No]
- Calculate distance using Haversine formula

---

## STEP 8 — Visit Screen (active visit flow)

Triggered when salesman starts a visit at a customer location.

Bottom sheet that expands to full screen. Has 4 tabs:

**Tab 1: ORDER**

Product search (prominent, at top):
- Search input — searches local cached products
- Barcode scan button → opens camera for barcode scan (expo-barcode-scanner)
- Product results: name, price, available stock (from cache), add button

Cart (below search):
- Added products with quantity controls (- / qty / +)
- Running total
- "Place Order" button (gold, large)

On "Place Order":
- If online: POST /api/v1/orders (source: APP) then POST /api/v1/orders/:id/confirm
- If offline: enqueue { type: 'CREATE_ORDER', payload: { customerId, items, ... } }
- Show success: "Order #X confirmed! ₹Y" with haptic feedback

AI suggestion banner (below search, collapsible):
"💡 Last time you ordered: Surf Excel 1kg x5, Maggi 70g x10. Add again?"
Two buttons: "Add All" | "Dismiss"
Fetch from customer's last order history (from local cache).

**Tab 2: COLLECTION**

- Outstanding amount: ₹X (large, prominent)
- Amount input (numeric keyboard, pre-filled with outstanding)
- Payment method selector: Cash | UPI | Cheque | Bank Transfer
- Reference number input (required for Cheque/Bank, optional for UPI)
- Photo capture for cheque (opens camera if method = Cheque)
- "Record Collection" button

On submit:
- If online: POST /api/v1/payments (method, amount, customerId, referenceNumber)
- If offline: enqueue { type: 'RECORD_COLLECTION', payload: { ... } }
- Show: "₹X collected from [Customer]" toast + haptic feedback

**Tab 3: SHELF AUDIT**

- Instructions: "Take a clear photo of the shelf"
- Camera button (full-width, prominent)
- On photo captured: show preview
- "Analyze Shelf" button → POST /api/v1/shelf-audit (uploads photo + triggers AI)
- While analyzing: show "Analyzing shelf... (this may take 15-30 seconds)"
- On result: show formatted analysis:
  - "Your brands: X facings (Y% share of shelf)"
  - Competitor table
  - Compliance score: circular gauge
  - AI observations as bullet list
- Previous audit for this customer: small card at bottom showing last audit date + compliance score

**Tab 4: NOTES**

- Multi-line text input
- Quick tag buttons: "Price complaint" | "No stock" | "New product interest" | "Competitor activity" | "Relationship issue"
- Tags appear as chips, multiple can be selected
- "Save Notes" saved as part of FieldVisit record

**End Visit button (bottom, always visible):**
- Shows visit summary: time elapsed, tabs completed
- "End Visit" → POST /api/v1/visits with all collected data
- If offline: enqueue
- Navigate back to Route screen, mark customer as visited (green pin)

---

## STEP 9 — Order Screens

### app/(app)/orders/index.tsx — Order List

Tabs: Today's Orders | All Orders

Today's tab: orders placed today by this salesman
All tab: all orders assigned to this salesman (last 30 days)

Each order card: customer name, order number, time, amount, status badge, items count
Tap → order detail

### app/(app)/orders/new.tsx — Quick Order (standalone, outside visit)

Simplified order creation:
1. Customer search (from local cache, with offline support)
2. Products (same as visit tab)
3. Confirm + submit

### app/(app)/orders/[id].tsx — Order Detail

Status, items list, amounts, status history timeline
Action button: "Mark Delivered" if status = DISPATCHED

---

## STEP 10 — Collection Screen (app/(app)/collections.tsx)

Standalone collection screen (for collection-only visits):

Top: "Collections Today: ₹X / ₹Y target" progress bar

Customer list sorted by outstanding amount:
- Customer name + phone
- Outstanding: ₹X
- Days overdue colored badge
- "Collect" button → opens collection bottom sheet (same as Visit Tab 2)
- "Call" button → opens phone dialer

Pull-to-refresh to sync latest outstanding data.

---

## STEP 11 — Performance Screen (app/(app)/performance.tsx)

Personal KPI dashboard.

**Today's Summary (top):**
- Visits: X / Y planned
- Orders: X orders, ₹Y
- Collections: ₹X
- All as animated progress bars

**Target Achievement:**
- Monthly target: ₹X
- Achieved: ₹Y (progress ring, colored by % — red < 50%, yellow 50-80%, green > 80%)
- Days remaining in month

**Weekly Trend:**
- Small bar chart (last 7 days): orders placed per day
- Built with react-native-svg + D3 or a simple custom SVG implementation (no heavy chart library)

**Leaderboard (if visible to salesman role):**
- Top 5 salesmen in org by this month's orders
- Current salesman highlighted

---

## STEP 12 — Customer Screens

### app/(app)/customers/index.tsx

Search + list of assigned customers.
Each card: name, area, last order date, outstanding badge, payment score ring.
Tap → customer detail.

### app/(app)/customers/[id].tsx

Simplified 360 profile (mobile-optimized):
- Name, address, phone (tap to call), WhatsApp (tap to open wa.me)
- Outstanding: ₹X
- Payment score ring
- Last 5 orders (compact list)
- Last 3 visit logs
- "New Order" and "Collect" quick action buttons

---

## STEP 13 — Notifications

Configure Expo Notifications with FCM (Firebase Cloud Messaging).

On app launch: request notification permission, register FCM token, POST /api/v1/users/:id with updated fcmTokens array.

Handle these notification types:
- `new_order` — "New order from [customer]" → navigate to orders
- `low_stock` — "[Product] is low" → navigate to relevant order screen
- `collection_reminder` — "[Customer] has ₹X overdue" → navigate to collections
- `daily_target` — "You've reached X% of today's target!" → navigate to performance

Show in-app notification banner (custom, not system) when app is in foreground.

---

## STEP 14 — Offline Indicator Component

Always-visible strip at top of every screen when offline:

```typescript
// components/OfflineIndicator.tsx
function OfflineIndicator() {
  const isOnline = useNetworkStatus();
  const pendingCount = useOfflineQueue().getPendingCount();

  if (isOnline && pendingCount === 0) return null;
  if (isOnline && pendingCount > 0) return (
    <View style={syncingBannerStyle}>
      <ActivityIndicator size="small" color={colors.gold} />
      <Text>Syncing {pendingCount} items...</Text>
    </View>
  );

  return (
    <View style={offlineBannerStyle}>
      <Text>📵 Offline — data saved locally</Text>
    </View>
  );
}
```

---

## STEP 15 — Biometric Authentication (optional unlock)

After initial login, offer fingerprint/face unlock for subsequent opens:
```typescript
// On app resume (from background):
const biometricAuth = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Unlock DistroAI Field',
  cancelLabel: 'Use Password',
});
```

If biometric not available or user declines: require password.
Store preference in MMKV.

---

## STEP 16 — App Navigation Structure

Use Expo Router with tab navigator:

Bottom tab bar (5 tabs, always visible):
1. 🏠 Home (index.tsx)
2. 🗺️ Route (route.tsx)
3. 📦 Orders (orders/)
4. 💰 Collections (collections.tsx)
5. 📊 Performance (performance.tsx)

Tab bar styling:
- Background: #0F0C1A (dark, matches design system)
- Active tab: gold color + colored indicator dot
- Inactive: muted grey
- No labels (icons only) to save space

Stack navigation inside tabs for detail screens.

---

## STEP 17 — Polish & UX Details

These details make the difference between an app salesmen love and one they avoid:

**Haptic feedback:**
- Light haptic on every button press
- Medium haptic on successful order/collection
- Heavy haptic on error

**Loading states:**
- Skeleton screens (not spinners) for lists
- Inline activity indicators for button actions (disable button while loading)

**Error states:**
- Network error: "No connection. Saved offline." (never show technical errors)
- Server error: "Something went wrong. Try again." with retry button
- Validation error: red border + inline message

**Gestures:**
- Swipe right on order card → quick action (Mark Delivered)
- Swipe left on customer card → quick Call action
- Pull-to-refresh on all list screens

**Performance:**
- All list screens use FlatList (never ScrollView with map())
- Images lazy-loaded with placeholder
- Avoid re-renders: memo() on heavy components, useCallback on handlers

**Accessibility:**
- All interactive elements have accessibilityLabel
- Minimum touch target: 44x44px
- High contrast ratios maintained

---

## STEP 18 — Testing

Unit tests (Jest + React Native Testing Library):
- OfflineQueue: enqueue, dequeue, processQueue with mock API
- SyncEngine: verify offline actions replay correctly on reconnect
- Haversine distance: test with known coordinates (Mumbai to Delhi = ~1150km)
- Language detection: same utility from backend, ensure consistent behavior
- AmountInput: Indian currency formatting

Integration tests (Detox — if Detox can be set up, otherwise describe tests only):
- Login flow: enter credentials → lands on Home → see today's route
- Check-in: tap Check In → camera opens → (mock camera) → GPS captured → confirmed → Home shows checked in
- Create order offline: disable network → create order → queue shows 1 pending → enable network → order appears in backend
- Visit flow: start visit → place order → record collection → end visit → customer marked visited on route

---

## STEP 19 — Build Configuration

### EAS Build Setup
```json
// eas.json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "apk" }
    }
  }
}
```

### Environment variables (.env):
```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000   # local network IP for dev
EXPO_PUBLIC_GOOGLE_MAPS_KEY=
```

### APK size optimization:
- Enable Hermes JavaScript engine (already default in Expo 51)
- Enable ProGuard minification for release builds
- Split APKs by ABI (arm64-v8a, x86_64)
- Target APK size: under 30MB for release

---

## WHAT TO DELIVER

At end of Phase 6:

1. apps/mobile/ — complete Expo React Native app
2. All 12+ screens built and connected to API
3. Offline-first: queue works, sync engine works, local cache works
4. Check-in with selfie + GPS
5. Visit flow: 4 tabs (order, collection, audit, notes), all functional
6. Barcode scanning for product search
7. Google Maps route view with customer pins
8. Geofencing warning when starting visit
9. FCM push notifications registered
10. Biometric lock (optional unlock)
11. Unit tests for offline queue, sync engine, distance calculation
12. EAS build config for APK generation
13. README: how to run locally, how to build APK with EAS

Do NOT build:
- Kubernetes production deployment (Phase 7)
- Admin features (manager/owner features stay in web dashboard)
- WhatsApp integration in mobile (handled by backend bot)

Build for a salesman in rural India on a ₹8,000 Android phone with 2G connectivity.
