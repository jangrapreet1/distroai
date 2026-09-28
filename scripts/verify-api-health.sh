#!/usr/bin/env bash
ssh -o ConnectTimeout=8 -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
echo "=== Check container health status ==="
sudo docker ps --filter name=distroai_api

echo "=== Curl health endpoint from inside container ==="
sudo docker exec distroai_api curl -s http://localhost:3000/health

echo ""
echo "=== Check last 15 lines of distroai_api logs ==="
sudo docker logs --tail 15 distroai_api
EOF
