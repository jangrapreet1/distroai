#!/usr/bin/env bash
set -e

BACKUP_DIR="/home/preet/projects/distroai/backups/oracle_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=== 1. Creating PostgreSQL Dump on Oracle Server ==="
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec distroai_postgres pg_dump -U distroai -d distroai -F c -b -v -f /tmp/distroai_backup.dump
sudo docker exec distroai_postgres pg_dump -U distroai -d distroai --clean --if-exists > /tmp/distroai_backup.sql
sudo docker cp distroai_postgres:/tmp/distroai_backup.dump /tmp/distroai_backup.dump
sudo chmod 644 /tmp/distroai_backup.dump /tmp/distroai_backup.sql
EOF

echo "=== 2. Downloading Database Dumps to WSL ($BACKUP_DIR) ==="
scp -i ~/.ssh/oci.key opc@144.24.130.2:/tmp/distroai_backup.dump "$BACKUP_DIR/distroai_backup.dump"
scp -i ~/.ssh/oci.key opc@144.24.130.2:/tmp/distroai_backup.sql "$BACKUP_DIR/distroai_backup.sql"

echo "=== 3. Downloading .env.production config ==="
scp -i ~/.ssh/oci.key opc@144.24.130.2:/home/opc/app/infra/docker/.env.production "$BACKUP_DIR/.env.production" || true

echo "=== 4. Checking Uploads directory on Oracle ==="
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker cp distroai_api:/tmp/distroai-uploads /tmp/distroai_uploads 2>/dev/null || true
if [ -d /tmp/distroai_uploads ]; then
    tar -czf /tmp/distroai_uploads.tar.gz -C /tmp/distroai_uploads . 2>/dev/null || true
fi
EOF

scp -i ~/.ssh/oci.key opc@144.24.130.2:/tmp/distroai_uploads.tar.gz "$BACKUP_DIR/distroai_uploads.tar.gz" 2>/dev/null || echo "No upload archive found"

echo "=== Backup Complete! ==="
ls -lh "$BACKUP_DIR"
