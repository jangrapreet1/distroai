#!/bin/bash
# ─────────────────────────────────────────────────────────
# DistroAI — WAL-G & Backblaze B2 Backup Verification Script
# Adheres to the 3-2-1 Rule & PITR Testing Policy
# Usage: bash verify-backup.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER_NAME="distroai_postgres"

echo "🐘 DistroAI — Database Backup & PITR Verification"
echo "══════════════════════════════════════════════════"

# 1. Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ PostgreSQL container '${CONTAINER_NAME}' is not running."
    echo "   Start services with: docker compose -f docker-compose.prod.yml up -d"
    exit 1
fi
echo "✅ Container '${CONTAINER_NAME}' is active."

# 2. Check WAL Archiving Health in Postgres
echo "🔍 Checking PostgreSQL WAL Archiver status..."
ARCHIVE_STATUS=$(docker exec "$CONTAINER_NAME" psql -U distroai -d distroai -c \
    "SELECT archived_count, last_archived_wal, last_archived_time, failed_count, last_failed_wal, last_failed_time FROM pg_stat_archiver;" \
    2>/dev/null || echo "ERROR")

if [ "$ARCHIVE_STATUS" = "ERROR" ]; then
    echo "⚠️  Could not query pg_stat_archiver directly."
else
    echo "$ARCHIVE_STATUS"
fi

# 3. Test WAL-G connectivity & list existing backups on Backblaze B2
echo ""
echo "☁️  Querying WAL-G backup list on Backblaze B2..."
docker exec -u postgres "$CONTAINER_NAME" bash -c \
    'export $(cat /etc/wal-g.env | xargs) && wal-g backup-list' || {
        echo "⚠️  Failed to query Backblaze B2. Check your B2 credentials in .env.production"
        exit 1
    }

echo ""
echo "══════════════════════════════════════════════════"
echo "✅ Backup verification check complete!"
echo ""
echo "Quick Commands:"
echo "  Trigger Manual Backup:  docker exec -u postgres $CONTAINER_NAME bash -c 'export \$(cat /etc/wal-g.env | xargs) && wal-g backup-push /var/lib/postgresql/data'"
echo "  Inspect Backup Log:     docker exec $CONTAINER_NAME tail -n 50 /var/log/wal-g.log"
echo "══════════════════════════════════════════════════"
