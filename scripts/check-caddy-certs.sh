#!/usr/bin/env bash
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec distroai_caddy find /data -name "*distroai*" 2>/dev/null || true
EOF
