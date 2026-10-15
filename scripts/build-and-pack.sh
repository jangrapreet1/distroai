#!/usr/bin/env bash
set -e

export PATH="/home/preet/.nvm/versions/node/v22.17.1/bin:/usr/bin:/bin:$PATH"

echo "=== 1. Building apps/api ==="
cd /home/preet/projects/distroai/apps/api
pnpm build

echo "=== 2. Resolving all path aliases with tsc-alias ==="
npx tsc-alias -p tsconfig.json

echo "=== 3. Packaging API dist into /tmp/api-dist.tar.gz ==="
cd /home/preet/projects/distroai/apps/api/dist
tar -czf /tmp/api-dist.tar.gz .
ls -lh /tmp/api-dist.tar.gz

echo "=== 4. Copying to Oracle production server (144.24.130.2) ==="
scp -o GSSAPIAuthentication=no -o StrictHostKeyChecking=no -i ~/.ssh/oci.key /tmp/api-dist.tar.gz opc@144.24.130.2:/tmp/api-dist.tar.gz

echo "=== 5. Deploying to distroai_api container ==="
ssh -T -o GSSAPIAuthentication=no -o StrictHostKeyChecking=no -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker exec -u 0 -i distroai_api tar --no-same-owner --overwrite -xz -C /app/dist/ < /tmp/api-dist.tar.gz
sudo docker exec -u 0 distroai_api chown -R 1001:1001 /app/dist
sudo docker restart -t 2 distroai_api

echo "Waiting for distroai_api to boot and pass healthcheck..."
sleep 5
sudo docker ps --filter name=distroai_api --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
sudo docker exec distroai_api curl -s http://localhost:3000/health || true
EOF

echo "=== API Hot-Deployment Completed Successfully ==="
