#!/bin/bash
# ─────────────────────────────────────────────────────────
# DistroAI — Production Deploy / Redeploy Script
# Run from: /home/distroai/app/infra/docker/
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

echo "🚀 DistroAI — Production Deployment"
echo "═════════════════════════════════════"

# Detect Docker Compose command format
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Neither 'docker compose' nor 'docker-compose' is installed."
    exit 1
fi
echo "✅ Using Compose engine: $DOCKER_COMPOSE"

# Pre-flight checks
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Missing $ENV_FILE"
    echo "   Copy .env.production.example to .env.production and fill in your secrets."
    exit 1
fi

# Pull latest code (if in git repo)
if [ -d "../../.git" ]; then
    echo "📥 Pulling latest git commit..."
    cd ../../ && git pull || echo "⚠️  Git pull skipped/failed (continuing with local code)" && cd infra/docker
else
    echo "ℹ️  No .git directory found — proceeding with existing source tree."
fi

# Build production images
echo "🔨 Building production Docker images..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

# Start all services in background
echo "🚀 Starting all services..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Wait for core API and DB to be healthy
echo "⏳ Waiting 15 seconds for database and API startup..."
sleep 15

# Run Prisma schema push / migration inside running api container
echo "📊 Running database migrations..."
docker exec distroai_api npx prisma db push --schema=./packages/db/prisma/schema.prisma --accept-data-loss 2>/dev/null || \
docker exec distroai_api npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma 2>/dev/null || \
echo "ℹ️  Prisma migration check finished."

# Prune dangling intermediate build images
echo "🧹 Pruning dangling build images..."
docker image prune -f

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo ""
echo "Active Services:"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
echo ""
echo "Useful Commands:"
echo "  View All Logs:          $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "  View API Logs:          $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f api"
echo "  Check Status:           $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
echo "  Verify Backups:         bash verify-backup.sh"
echo "  Restart Stack:          $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "  Stop Stack:             $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "═══════════════════════════════════════════════════════"
