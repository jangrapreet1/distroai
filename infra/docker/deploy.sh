#!/bin/bash
# ─────────────────────────────────────────────────────────
# DistroAI — Deploy / Redeploy Script
# Run from: /home/distroai/app/infra/docker/
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

echo "🚀 DistroAI — Deploying"
echo "═══════════════════════"

# Pre-flight checks
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Missing $ENV_FILE"
    echo "   Copy .env.production.example to .env.production and fill in your values"
    exit 1
fi

# Pull latest code (if this is a git repo)
if [ -d "../../.git" ]; then
    echo "📥 Pulling latest code..."
    cd ../../ && git pull && cd infra/docker
fi

# Build images
echo "🔨 Building Docker images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

# Start database + redis first
echo "🗄️  Starting database and Redis..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis
echo "⏳ Waiting for database to be ready..."
sleep 5

# Run Prisma migrations
echo "📊 Running database migrations..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api \
    npx prisma@5.22.0 migrate deploy --schema=./packages/db/prisma/schema.prisma 2>/dev/null || \
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api \
    npx prisma@5.22.0 db push --schema=./packages/db/prisma/schema.prisma

# Start all services
echo "🚀 Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Cleanup old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo ""
echo "Services:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Useful commands:"
echo "  Logs:     docker compose -f $COMPOSE_FILE logs -f"
echo "  API logs: docker compose -f $COMPOSE_FILE logs -f api"
echo "  Status:   docker compose -f $COMPOSE_FILE ps"
echo "  Restart:  docker compose -f $COMPOSE_FILE restart"
echo "  Stop:     docker compose -f $COMPOSE_FILE down"
echo "═══════════════════════════════════════════════════════"
