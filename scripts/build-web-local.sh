#!/usr/bin/env bash
set -e
cd /home/preet/projects/distroai
echo "=== Building Web Frontend image locally ==="
docker build -f infra/docker/Dockerfile.web \
  --build-arg API_INTERNAL_URL="http://api:3000" \
  --build-arg NEXT_PUBLIC_META_APP_ID="1281468493561220" \
  -t distroai-web .
echo "=== Web Build Completed Successfully ==="
