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
scp -o GSSAPIAuthentication=no -o StrictHostKeyChecking=no -i ~/.ssh/oci.key /tmp/web-standalone.tar.gz /tmp/web-static.tar.gz /tmp/web-public.tar.gz opc@144.24.130.2:/tmp/

echo "=== 6. Extracting into distroai_web container and restarting ==="
ssh -T -o GSSAPIAuthentication=no -o StrictHostKeyChecking=no -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec -u 0 -i distroai_web tar --no-same-owner --overwrite -xz -C /app/ < /tmp/web-standalone.tar.gz
sudo docker exec -u 0 -i distroai_web tar --no-same-owner --overwrite -xz -C /app/apps/web/.next/ < /tmp/web-static.tar.gz
sudo docker exec -u 0 -i distroai_web tar --no-same-owner --overwrite -xz -C /app/apps/web/ < /tmp/web-public.tar.gz
sudo docker exec -u 0 distroai_web chown -R 1001:1001 /app
sudo docker restart -t 2 distroai_web

echo "Waiting for distroai_web to boot..."
sleep 6
sudo docker ps --filter name=distroai_web --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Local Web Status: HTTP %{http_code}\n" http://localhost:3001/ || true
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Local Login Status: HTTP %{http_code}\n" http://localhost:3001/login || true
sudo docker exec distroai_web curl -s -m 5 -o /dev/null -w "Local sw.js Status: HTTP %{http_code}\n" http://localhost:3001/sw.js || true
EOF

echo "=== Web Hot-Deployment Completed Successfully ==="
