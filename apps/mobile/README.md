# DistroAI Field — React Native Mobile App

Salesman-facing mobile app built with **Expo SDK 51**, **expo-router**, **MMKV**, and **Zustand**.

## Prerequisites

- Node.js 18+
- pnpm
- EAS CLI (`npm install -g eas-cli`)
- Expo Go app (for development)

## Development

```bash
# Install dependencies
cd apps/mobile
pnpm install

# Start Expo dev server
pnpm start

# Run on Android emulator
pnpm android

# Run on iOS simulator
pnpm ios
```

## Environment Variables

Copy `.env.example` to `.env` and set:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

For staging/production, the API URL is configured in `eas.json` build profiles.

## Build (EAS)

```bash
# Development APK (for internal testing)
eas build --profile development --platform android

# Preview APK (staging API)
eas build --profile preview --platform android

# Production AAB (for Play Store)
eas build --profile production --platform android
```

## Architecture

- **Offline-First**: All mutations queue via MMKV when offline, sync on reconnect
- **MMKV Storage**: Auth tokens, offline queue, local cache (products, customers, route)
- **Sync Engine**: NetInfo listener with 10s backoff, flushes queue on connectivity
- **Biometric Lock**: Prompts fingerprint/face after 5 min in background
- **Push Notifications**: Expo push tokens registered on login, deep-link on tap

## Testing

```bash
pnpm test
```

Tests cover: offline queue FIFO order, Haversine distance calculations, sync replay order.

## Project Structure

```
app/
  _layout.tsx          # Root: QueryClient, Auth, FCM, Biometric
  (auth)/login.tsx     # Login screen
  (app)/
    _layout.tsx        # Tab navigator (Home, Route, Orders, Collections, Performance)
    index.tsx          # Home: check-in, targets, quick actions, route preview
    route.tsx          # Daily route with map + customer list
    collections.tsx    # Payment collection with customer list
    performance.tsx    # SVG charts (progress ring, bar chart, leaderboard)
    audit.tsx          # Visit screen (4 tabs: Order, Collect, Audit, Notes)
    orders/            # Order list (Today/All tabs) + detail with timeline
    customers/         # Customer list + detail with actions
components/
  ui/                  # Design system (Button, Card, Input, Badge, ListItem, StatCard, Skeleton...)
  OfflineIndicator.tsx # Network/sync status banner
lib/
  api-client.ts        # Axios with JWT refresh + offline interceptor
  offline-queue.ts     # MMKV-backed FIFO action queue
  local-cache.ts       # TTL-based cache with getCachedOrFetch
  sync-engine.ts       # NetInfo listener + processQueue + refreshCache
  notifications.ts     # FCM token registration + tap handler
  biometrics.ts        # Fingerprint/face unlock with MMKV prefs
  utils.ts             # Haversine, formatINR
stores/
  auth.store.ts        # Zustand + MMKV persistence
  sync.store.ts        # Reactive sync state for UI
```
