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
    cd ../../ && git pull || echo "⚠️  Git pull failed (continuing anyway)" && cd infra/docker
else
    echo "ℹ️  No .git directory found — skipping git pull (rsync deploy mode)"
fi

# Build images
echo "🔨 Building Docker images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

# Start all services
echo "🚀 Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Wait for API container to be ready
echo "⏳ Waiting for API to start..."
sleep 15

# Run Prisma migrations inside the running api container
echo "📊 Running database migrations..."
docker exec distroai_api npx prisma db push --schema=./packages/db/prisma/schema.prisma --accept-data-loss 2>/dev/null || \
docker exec distroai_api npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma 2>/dev/null || \
echo "⚠️  Migration skipped (will auto-run on API startup)"

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
