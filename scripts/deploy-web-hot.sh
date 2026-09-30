#!/usr/bin/env bash
set -e

echo "=== 1. Packaging Web Standalone ==="
cd /home/preet/projects/distroai/apps/web/.next/standalone
tar -czf /tmp/web-standalone.tar.gz apps/web

echo "=== 2. Packaging Web Static ==="
cd /home/preet/projects/distroai/apps/web/.next
tar -czf /tmp/web-static.tar.gz static

echo "=== 3. Packaging Web Public (Service Worker & Assets) ==="
cd /home/preet/projects/distroai/apps/web
tar -czf /tmp/web-public.tar.gz public

echo "=== 4. Checking archive sizes ==="
ls -lh /tmp/web-standalone.tar.gz /tmp/web-static.tar.gz /tmp/web-public.tar.gz

echo "=== 5. Copying to Oracle production server (144.24.130.2) ==="
scp -o StrictHostKeyChecking=no -i ~/.ssh/oci.key /tmp/web-standalone.tar.gz /tmp/web-static.tar.gz /tmp/web-public.tar.gz opc@144.24.130.2:/tmp/

echo "=== 6. Extracting into distroai_web container and restarting ==="
ssh -o StrictHostKeyChecking=no -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker cp /tmp/web-standalone.tar.gz distroai_web:/tmp/web-standalone.tar.gz
sudo docker cp /tmp/web-static.tar.gz distroai_web:/tmp/web-static.tar.gz
sudo docker cp /tmp/web-public.tar.gz distroai_web:/tmp/web-public.tar.gz

sudo docker exec -u 0 distroai_web tar --no-same-owner --overwrite -xzf /tmp/web-standalone.tar.gz -C /app/
sudo docker exec -u 0 distroai_web tar --no-same-owner --overwrite -xzf /tmp/web-static.tar.gz -C /app/apps/web/.next/
sudo docker exec -u 0 distroai_web tar --no-same-owner --overwrite -xzf /tmp/web-public.tar.gz -C /app/apps/web/
sudo docker exec -u 0 distroai_web chown -R 1001:1001 /app
sudo docker restart distroai_web

echo "Waiting for distroai_web to boot..."
sleep 6
sudo docker ps --filter name=distroai_web --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Local Web Status: HTTP %{http_code}\n" http://localhost:3001/ || true
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Local Login Status: HTTP %{http_code}\n" http://localhost:3001/login || true
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Local sw.js Status: HTTP %{http_code}\n" http://localhost:3001/sw.js || true
EOF

echo "=== Web Hot-Deployment Completed Successfully ==="
