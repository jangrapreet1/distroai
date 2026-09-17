#!/bin/bash
exec >> /home/opc/deploy.log 2>&1
echo "=================================================="
echo "Starting Unattended Build at $(date)"
echo "=================================================="

cd /home/opc/app/infra/docker

echo "--- [1/4] Building API Backend ---"
docker compose -f docker-compose.prod.yml build api

echo "--- [2/4] Building Background Worker ---"
docker compose -f docker-compose.prod.yml build worker

echo "--- [3/4] Building Web Frontend ---"
docker compose -f docker-compose.prod.yml build web

echo "--- [4/4] Launching All Services ---"
docker compose -f docker-compose.prod.yml up -d

echo "--- Running Prisma Database Migrations ---"
sleep 5
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma || true

echo "=================================================="
echo "DistroAI Full Deployment Finished at $(date)!"
echo "=================================================="
docker compose -f docker-compose.prod.yml ps
