#!/usr/bin/env bash
ssh -o StrictHostKeyChecking=no distroai@116.202.29.65 << 'EOF'
docker exec -i distroai_postgres psql -U distroai -d distroai -c '\d "Product"'
EOF
