#!/usr/bin/env bash
set -e

ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
echo "=== 1. DATABASE RECORD COUNTS ==="
sudo docker exec distroai_postgres psql -U distroai -d distroai -c '
SELECT
  (SELECT count(*) FROM "Organization") as orgs,
  (SELECT count(*) FROM "User") as users,
  (SELECT count(*) FROM "Customer") as customers,
  (SELECT count(*) FROM "Product") as products,
  (SELECT count(*) FROM "Order") as orders,
  (SELECT count(*) FROM "Invoice") as invoices;
'

echo "=== 2. PRODUCTION DOMAIN & CADDY ENV ==="
sudo docker inspect distroai_caddy | grep -i "DOMAIN" || true

echo "=== 3. APP DIRECTORY LOCATION ON ORACLE ==="
pwd
ls -la /home/distroai/app/infra/docker 2>/dev/null || ls -la ~/
EOF
