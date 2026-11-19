#!/bin/bash
set -euo pipefail

HETZNER_IP="116.202.29.65"
HETZNER_USER="distroai"
DEST_DIR="/home/distroai/app"
BACKUP_DIR="/home/preet/projects/distroai/backups/oracle_20261022_065350"

echo "📦 Syncing DistroAI codebase to Hetzner ($HETZNER_IP)..."

rsync -avz --delete \
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
  /home/preet/projects/distroai/ \
  ${HETZNER_USER}@${HETZNER_IP}:${DEST_DIR}/

echo "🔑 Copying .env.production to Hetzner..."
scp "${BACKUP_DIR}/.env.production" "${HETZNER_USER}@${HETZNER_IP}:${DEST_DIR}/infra/docker/.env.production"

echo "💾 Copying backups to Hetzner..."
ssh ${HETZNER_USER}@${HETZNER_IP} "mkdir -p /home/distroai/backups"
rsync -avz "${BACKUP_DIR}/" "${HETZNER_USER}@${HETZNER_IP}:/home/distroai/backups/"

echo "✅ Sync complete!"
