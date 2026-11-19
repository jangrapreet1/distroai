#!/usr/bin/env bash
ssh distroai@116.202.29.65 << 'EOF'
docker exec -i distroai_postgres psql -U distroai -d distroai -c 'SELECT id, "orgId", name, sku FROM "Product";'
docker exec -i distroai_postgres psql -U distroai -d distroai -c 'SELECT id, name FROM "Organization";'
EOF
