#!/bin/bash
set -e

echo "=== 1. API Direct Health Check ==="
docker exec distroai_api curl -s http://127.0.0.1:3000/health
echo ""

echo "=== 2. AI Service Health Check ==="
docker exec distroai_ai python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
echo ""

echo "=== 3. Web Direct Login Check ==="
docker exec distroai_web curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/login

echo "=== 4. Caddy Healthz (Port 80) ==="
curl -s -H "Host: distroai.in" http://127.0.0.1/healthz
echo ""

echo "=== 5. Caddy HTTPS Web Login (Port 443 with SSL) ==="
curl -s -o /dev/null -w "HTTPS %{http_code}\n" --resolve distroai.in:443:127.0.0.1 https://distroai.in/login

echo "=== 6. Caddy HTTPS API Health (Port 443 with SSL) ==="
curl -s --resolve api.distroai.in:443:127.0.0.1 https://api.distroai.in/health
echo ""

echo "=== 7. Uploaded File Serving via API ==="
docker exec distroai_api curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000/api/v1/storage/local/uploads/1792345790465-775204730.png

echo "=== 8. Database Record Parity Check ==="
docker exec distroai_postgres psql -U distroai -d distroai -c '
SELECT 
  (SELECT count(*) FROM "Organization") as orgs,
  (SELECT count(*) FROM "User") as users,
  (SELECT count(*) FROM "Customer") as customers,
  (SELECT count(*) FROM "Product") as products,
  (SELECT count(*) FROM "Order") as orders,
  (SELECT count(*) FROM "Invoice") as invoices;
'
