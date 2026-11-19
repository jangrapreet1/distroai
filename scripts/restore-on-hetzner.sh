#!/bin/bash
set -euo pipefail

echo "🔄 Starting Database and Uploads Restore on Hetzner..."

# 1. Enable pgvector
docker exec distroai_postgres psql -U distroai -d distroai -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 2. Copy dump into container and restore
echo "📥 Restoring PostgreSQL database from dump..."
docker cp /home/distroai/backups/distroai_backup.dump distroai_postgres:/tmp/distroai_backup.dump
docker exec distroai_postgres pg_restore -U distroai -d distroai --clean --if-exists --no-owner --no-privileges /tmp/distroai_backup.dump || true

# 3. Verify row counts
echo "📊 Verifying restored table row counts:"
docker exec distroai_postgres psql -U distroai -d distroai -c '
SELECT 
  (SELECT count(*) FROM "Organization") as orgs,
  (SELECT count(*) FROM "User") as users,
  (SELECT count(*) FROM "Customer") as customers,
  (SELECT count(*) FROM "Product") as products,
  (SELECT count(*) FROM "ProductVariant") as variants,
  (SELECT count(*) FROM "Order") as orders,
  (SELECT count(*) FROM "Invoice") as invoices;
'

# 4. Restore Uploads into volume
echo "📁 Restoring uploads into docker volume..."
docker volume create docker_uploads_data || true
docker run --rm \
  -v docker_uploads_data:/data \
  -v /home/distroai/backups/distroai_uploads.tar.gz:/tmp/distroai_uploads.tar.gz \
  alpine sh -c "cd /data && tar -xzf /tmp/distroai_uploads.tar.gz && chown -R 1001:1001 /data"

echo "📂 Verifying uploads:"
docker run --rm -v docker_uploads_data:/data ls -la /data/uploads

echo "✅ Restore completed successfully!"
