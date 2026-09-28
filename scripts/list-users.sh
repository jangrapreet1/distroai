#!/usr/bin/env bash
ssh -o ConnectTimeout=8 -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec -i distroai_postgres psql -U distroai -d distroai -c 'SELECT id, email, role, "isActive", "orgId" FROM "User";'
EOF
