# DistroAI API — Local Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

## Setup

```bash
# From monorepo root
pnpm install

# Start local services
docker compose -f infra/docker/docker-compose.yml up -d

# Push database schema
cd packages/db && DATABASE_URL="postgresql://..." pnpm exec prisma db push

# Seed database
DATABASE_URL="postgresql://..." pnpm exec prisma db seed
```

## Running the API

```bash
# From monorepo root (via Turborepo)
pnpm --filter @distroai/api run start:dev

# Or directly from apps/api
cd apps/api
cp .env.example .env  # Fill in your secrets
pnpm start:dev
```

## Endpoints

| Route | Description |
|-------|-------------|
| `GET /health` | Health check (DB + Redis status) |
| `GET /api/docs` | Swagger UI |
| `POST /api/v1/auth/register` | Register new org |
| `POST /api/v1/auth/login` | Login |
| `GET /api/v1/analytics/dashboard` | Main KPI dashboard |

## Running Tests

```bash
# Unit tests
pnpm --filter @distroai/api run test

# E2E tests (requires test DB)
DATABASE_URL_TEST=postgresql://... pnpm --filter @distroai/api run test:e2e
```

## Environment Variables

Copy `.env.example` to `.env` and fill in all required values. Required:
- `DATABASE_URL`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`
- `NODE_ENV`
