#!/usr/bin/env bash
set -e
cd /home/preet/projects/distroai
echo "=== Building API image locally ==="
docker build -f infra/docker/Dockerfile.api -t distroai-api .
echo "=== API Build Completed Successfully ==="
