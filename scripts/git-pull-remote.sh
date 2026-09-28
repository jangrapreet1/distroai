#!/usr/bin/env bash
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
cd /home/opc/app
echo "=== Resetting local server repo to clean state ==="
git reset --hard HEAD
git clean -fd

echo "=== Pulling latest master from GitHub ==="
git pull origin master

echo "=== Latest commit on server ==="
git log -n 1 --oneline
EOF
