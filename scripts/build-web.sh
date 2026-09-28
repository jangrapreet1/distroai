#!/usr/bin/env bash
set -e
export PATH="/home/preet/.nvm/versions/node/v22.17.1/bin:$PATH"
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=4096"

cd /home/preet/projects/distroai/apps/web
echo "=== Building Next.js Web Frontend ==="
pnpm run build
echo "=== Next.js Web Build Finished ==="
