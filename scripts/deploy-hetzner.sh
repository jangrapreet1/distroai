#!/usr/bin/env bash
set -euo pipefail

HETZNER_IP="2.31.109.248"
DEST_DIR="/home/distroai/app"

echo "=========================================================="
echo "🚀 Deploying DistroAI to Hetzner (${HETZNER_IP})"
echo "=========================================================="

echo "📦 Step 1: Syncing codebase to Hetzner..."
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'build' \
  --exclude '.turbo' \
  --exclude 'venv' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '.pytest_cache' \
  --exclude 'backups' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude 'infra/docker/.env.production' \
  --exclude 'infra/docker/.env' \
  --exclude '.env*' \
  --exclude '**/.env*' \
  --exclude '**/.env*.local' \
  /home/preet/projects/distroai/ \
  root@${HETZNER_IP}:${DEST_DIR}/

echo "🔒 Step 2: Setting file permissions..."
ssh root@${HETZNER_IP} "chown -R distroai:distroai ${DEST_DIR}"

echo "🔨 Step 3: Building & Restarting Production Containers (API & Web)..."
ssh root@${HETZNER_IP} "cd ${DEST_DIR}/infra/docker && docker compose -f docker-compose.prod.yml up -d --build api web"

echo "⏳ Waiting for containers to initialize..."
sleep 10

echo "📊 Step 4: Synchronizing Prisma Database Schema..."
ssh root@${HETZNER_IP} "docker exec distroai_api npx prisma db push --schema=./packages/db/prisma/schema.prisma --accept-data-loss"

echo "🩺 Step 5: Verifying Health on Hetzner..."
ssh root@${HETZNER_IP} << 'EOF'
echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== API Health ==="
curl -s --resolve api.distroai.in:443:127.0.0.1 https://api.distroai.in/health || curl -s http://127.0.0.1:3000/health
echo ""

echo "=== Web Health ==="
curl -s -I --resolve distroai.in:443:127.0.0.1 https://distroai.in/login | head -n 5
EOF

echo "=========================================================="
echo "✅ Hetzner Deployment Finished Successfully!"
echo "=========================================================="
