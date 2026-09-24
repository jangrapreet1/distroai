#!/usr/bin/env bash
set -e

# Use node from fnm or nvm
export PATH="/home/preet/.local/share/fnm/node-versions/v20.20.0/installation/bin:/home/preet/.nvm/versions/node/v22.17.1/bin:$PATH"

echo "=== Node version ==="
node -v

echo "=== Running API Tests (customer-transactions) ==="
cd /home/preet/projects/distroai/apps/api
./node_modules/.bin/jest src/customer-transactions/ --no-cache

echo "=== Running API Typecheck ==="
cd /home/preet/projects/distroai/apps/api
./node_modules/.bin/tsc --noEmit && echo "API TSC PASSED"

echo "=== Running Web UI Tests (customer-ledger) ==="
cd /home/preet/projects/distroai/apps/web
./node_modules/.bin/jest src/__tests__/customer-ledger --no-cache && echo "WEB JEST PASSED"

echo "=== Running Web UI Typecheck ==="
cd /home/preet/projects/distroai/apps/web
./node_modules/.bin/tsc --noEmit && echo "WEB TSC PASSED"

echo "=== Running Standalone PDF Generation Test ==="
cd /home/preet/projects/distroai/apps/api
node stress-verify-pdf.js && echo "STRESS PDF PASSED"

echo "=== ALL VERIFICATIONS PASSED ==="
