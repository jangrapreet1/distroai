#!/usr/bin/env bash
ssh -o StrictHostKeyChecking=no distroai@116.202.29.65 << 'EOF'
echo "=== USERS ==="
docker exec -i distroai_postgres psql -U distroai -d distroai -c 'SELECT id, email, role, "isActive", "orgId" FROM "User";'

echo "=== PRODUCTS ==="
docker exec -i distroai_postgres psql -U distroai -d distroai -c 'SELECT id, name, sku, "sellingPrice", "isDraft", "hasVariants" FROM "Product";'
EOF
