#!/usr/bin/env bash
echo "=== 1. Testing Customers Template Endpoint ==="
curl -s -I -H "x-suppress-upgrade-modal: true" https://api.distroai.in/api/v1/customers/import/template | head -n 12

echo ""
echo "=== 2. Testing Orders Template Endpoint ==="
curl -s -I -H "x-suppress-upgrade-modal: true" https://api.distroai.in/api/v1/orders/import/template | head -n 12
