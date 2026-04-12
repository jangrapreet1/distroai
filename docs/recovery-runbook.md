# DistroAI — Disaster Recovery Runbook

This document acts as the ultimate truth for restoring the DistroAI platform from a catastrophic failure, specifically "Loss of Hetzner VPS".

## Critical Mandate
DistroAI manages financial infrastructure for distributors. Losing orders or payments is completely unacceptable. You **MUST** strictly follow the WAL-G restoration steps below.

---

## 🚨 SCENARIO: Total Hetzner VPS Destruction
**Symptom:** VPS drops entirely via Hetzner Cloud Console. Server cannot be SSH'd. Total Platform Outage.
**Target Disruption Window (RTO):** 20 - 30 minutes.

### Step 1: Spin Up Replacement Infrastructure (Est: 3 mins)
1. Login to Hetzner Cloud Console.
2. Spin up a new CPX21 or CAX21 (ARM64) instance identically sized to the destroyed one. Ensure it assigns a fresh dedicated IPv4.
3. Attach your deploy SSH key to the instance.

### Step 2: Reroute Production DNS (Est: 2 mins)
1. Login to Cloudflare / AWS Route53 (wherever `api.distroai.in` and `app.distroai.in` resolve).
2. Update the A records to point away from the dead Droplet IP toward the newly provisioned Hetzner IP.
3. *Note: TTL should already be configured to 60s for immediate propagation.*

### Step 3: Server Bootstrap & Keys (Est: 5 mins)
1. SSH into the new server: `ssh root@<NEW_IP>`.
2. Install Docker & Docker Compose natively. 
3. Retrieve secrets safely. Create `/etc/distroai/.env` matching the layout of your Github Actions secrets.

### Step 4: Postgres Recovery via WAL-G (Est: 10 mins)
*This is the most critical step to guarantee zero data loss!*

1. Clone the `docker-compose.yml` but ONLY launch the Postgres container:
   `docker compose up -d postgres`
2. **Halt operations:** ensure Postgres `listen_addresses` blocks external API connection until fully resolved.
3. Hook `WAL-G` to the Backblaze B2 credentials (set as ENV inside `postgres` container).
4. **Fetch Base Backup:** Run WAL-G to pull the latest daily snapshot from B2 into `/var/lib/postgresql/data`.
   `wal-g backup-fetch /var/lib/postgresql/data LATEST`
5. **Replay WALs (Point-In-Time):** Let Postgres boot up in recovery mode pointing at B2 to replay the WAL archives minute-by-minute up to the 5 seconds *before* the server crashed.
   `touch /var/lib/postgresql/data/recovery.signal`
   Start Postgres and monitor `top`/`docker logs` until the database is hot and consistent.

### Step 5: Full Application Relaunch (Est: 3 mins)
1. Once Postgres confirms consistency in logs, pull all remaining services.
2. `docker compose pull`
3. `docker compose up -d` (Spins up NestJS API, Next.js Web, Python AI Service, and Redis).
4. Run `npm run prisma migrate deploy` locally or securely trigger standard CI/CD deployment logic to rebuild state mapping.
5. Tail logs across `docker compose logs -f` to watch Caddy dynamically snag fresh SSL certs from Let's Encrypt. Platform should turn Green.
