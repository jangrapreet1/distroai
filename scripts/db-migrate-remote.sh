#!/usr/bin/env bash
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
echo "=== Step 1: Push schema changes to Postgres DB ==="
cd /home/opc/app/infra/docker
sudo docker exec distroai_api npx prisma db push --schema=packages/db/prisma/schema.prisma --accept-data-loss=false

echo "=== Step 2: Apply RLS migration SQL ==="
sudo docker exec -i distroai_postgres psql -U distroai -d distroai < /home/opc/app/packages/db/prisma/migrations/20260921_customer_transactions_rls/migration.sql || true

echo "=== Step 3: Verify Tables in PostgreSQL ==="
sudo docker exec distroai_postgres psql -U distroai -d distroai -c "\d CustomerTransaction"
EOF
