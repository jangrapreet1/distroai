#!/usr/bin/env bash
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
echo "=== Step 1: Git Status on Server ==="
cd /home/opc/app
git status --short

echo "=== Step 2: Ensure Git Remote is Origin Master ==="
git remote -v
EOF
