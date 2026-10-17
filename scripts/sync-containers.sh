#!/usr/bin/env bash
set -e

echo "=== Syncing artifacts into distroai_web and distroai_api ==="
ssh -T -o GSSAPIAuthentication=no -o StrictHostKeyChecking=no -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec -u 0 -i distroai_web tar --no-same-owner --overwrite -xz -C /app/ < /tmp/web-standalone.tar.gz
sudo docker exec -u 0 -i distroai_web tar --no-same-owner --overwrite -xz -C /app/apps/web/.next/ < /tmp/web-static.tar.gz
sudo docker exec -u 0 -i distroai_web tar --no-same-owner --overwrite -xz -C /app/apps/web/ < /tmp/web-public.tar.gz
sudo docker exec -u 0 distroai_web chown -R 1001:1001 /app
sudo docker restart -t 2 distroai_web

sudo docker exec -u 0 -i distroai_api tar --no-same-owner --overwrite -xz -C /app/dist/ < /tmp/api-dist.tar.gz
sudo docker exec -u 0 distroai_api chown -R 1001:1001 /app/dist
sudo docker restart -t 2 distroai_api

echo "Waiting for services..."
sleep 5
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Web Status: HTTP %{http_code}\n" http://localhost:3001/login
sudo docker exec distroai_api curl -s -m 5 -o /dev/null -w "API Health Status: HTTP %{http_code}\n" http://localhost:3000/health
EOF
echo "=== Done ==="
