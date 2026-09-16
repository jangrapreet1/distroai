# DistroAI — Oracle Cloud Always Free Tier Deployment Guide

This guide walks you through deploying the entire **DistroAI** stack (Next.js 16 Web + NestJS API + PostgreSQL 15 + Redis 7 + Python AI + Caddy SSL + WAL-G Backups) on **Oracle Cloud Infrastructure (OCI) Always Free Tier for \$0/month for life**.

---

## 💎 What Oracle Cloud Always Free Provides

| Resource | Free Tier Allowance | DistroAI Allocation |
| :--- | :--- | :--- |
| **Compute Architecture** | **Ampere A1 (ARM64)** | `VM.Standard.A1.Flex` |
| **OCPUs** | Up to **4 OCPUs** (Free) | **4 OCPUs** |
| **Memory (RAM)** | Up to **24 GB RAM** (Free) | **24 GB RAM** (Ample room for everything) |
| **Storage** | Up to **200 GB Block Volume** (Free) | **100 GB – 150 GB** NVMe Boot Volume |
| **Bandwidth** | **10 TB / month** Outbound (Free) | More than enough for Indian FMCG distributors |
| **Public IPv4** | 1 Ephemeral / Reserved IPv4 (Free) | Reserved Public IP |

---

## 🛠️ Step 1: Create Your OCI Free Tier VM

1. Log in to the [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Menu (☰) $\rightarrow$ Compute $\rightarrow$ Instances $\rightarrow$ Create Instance**.
3. Configure the instance settings:
   - **Name**: `distroai-production`
   - **Placement**: Default Availability Domain (e.g. `AD-1`)
   - **Image and Shape**:
     - Click **Change Image**: Select **Canonical Ubuntu $\rightarrow$ Ubuntu 24.04 (aarch64)** or **Ubuntu 22.04 LTS (aarch64)**.
     - Click **Change Shape**: Select **Ampere (ARM-based Processor) $\rightarrow$ VM.Standard.A1.Flex**.
     - Set **OCPUs**: `4` (or `2`)
     - Set **Memory**: `24 GB` (or `12 GB`)
     - Verify it shows the label: **"Always Free Eligible"** ✅.
   - **Networking**:
     - Select **Create new Virtual Cloud Network (VCN)** or choose existing.
     - Ensure **Assign a public IPv4 address** is set to **Yes**.
   - **Add SSH Keys**:
     - Select **Generate a key pair for me** (download both the private and public key) OR upload your existing `~/.ssh/id_rsa.pub`.
   - **Boot Volume**:
     - Check **Specify a custom boot volume size**: Enter **`100` GB** (free up to 200 GB).
4. Click **Create** and wait 60 seconds for the instance status to turn **RUNNING (Green)**.
5. Copy your **Public IP Address** (e.g. `129.153.x.x`).

---

## 🔓 Step 2: Configure Oracle Cloud Firewall (VCN Security List)

> [!IMPORTANT]
> Oracle Cloud blocks all ports except 22 by default at the cloud network level. You must open ports 80 and 443 in the OCI Console.

1. In the Instance details page, click on your **Subnet** link under **Instance Access**.
2. Click on the **Default Security List for your VCN**.
3. Under **Ingress Rules**, click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80,443`
   - **Description**: `HTTP and HTTPS for DistroAI Web & API`
4. Click **Add Ingress Rules**.

---

## 🚀 Step 3: Run the Automated Server Setup

Connect to your Oracle instance via SSH:

```bash
# On your local machine (using the private key you downloaded)
ssh -i /path/to/ssh-key.key ubuntu@YOUR_ORACLE_PUBLIC_IP
```

Run the DistroAI automated hardening script (handles Docker, non-root user, UFW, OCI iptables unblocking, and swap):

```bash
curl -fsSL https://raw.githubusercontent.com/jangrapreet1/distroai/master/infra/docker/setup-server.sh | sudo bash
```

---

## 📦 Step 4: Clone & Configure Environment

Switch to the isolated `distroai` application user:

```bash
sudo su - distroai
```

Clone the repository into the app folder:

```bash
git clone https://github.com/jangrapreet1/distroai.git /home/distroai/app
cd /home/distroai/app/infra/docker
```

Create your production environment file:

```bash
cp .env.production.example .env.production
nano .env.production
```

### Essential Variables to Fill in `.env.production`:
- `DOMAIN=yourdomain.com` (or your subdomain, e.g. `distro.yourdomain.com`)
- `POSTGRES_PASSWORD=generate_a_strong_password_here`
- `REDIS_PASSWORD=generate_another_strong_password`
- `JWT_SECRET=run_openssl_rand_hex_32`
- `JWT_REFRESH_SECRET=run_openssl_rand_hex_32`
- `WALG_S3_PREFIX=s3://distroai-prod-backups/walg` (optional: your Backblaze B2 bucket for 3-2-1 backups)
- `AWS_ACCESS_KEY_ID_B2=your_b2_key_id`
- `AWS_SECRET_ACCESS_KEY_B2=your_b2_secret_key`

*(Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit nano)*.

---

## 🏁 Step 5: Launch the Application

Launch all services with one command:

```bash
bash deploy.sh
```

This script will:
1. Build the production Docker images natively for ARM64 (Ampere A1).
2. Start all 7 containers in the isolated network.
3. Automatically run Prisma database migrations.
4. Auto-provision free Let's Encrypt SSL certificates via Caddy.

---

## 🌐 Step 6: Point Your Domain DNS

Go to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) and add two **A Records**:

| Type | Name | IPv4 Value | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (or `subdomain`) | `YOUR_ORACLE_PUBLIC_IP` | Auto / 300 |
| **A** | `api` (or `api.subdomain`) | `YOUR_ORACLE_PUBLIC_IP` | Auto / 300 |

Once DNS propagates (usually 1–5 minutes), Caddy automatically acquires and installs zero-touch HTTPS TLS 1.3 certificates!

---

## 🛠️ Management & Monitoring Commands

From `/home/distroai/app/infra/docker`:

```bash
# View live container status
docker compose -f docker-compose.prod.yml ps

# View live API logs
docker compose -f docker-compose.prod.yml logs -f api

# View live Caddy reverse proxy logs
docker compose -f docker-compose.prod.yml logs -f caddy

# Test database backup connectivity
bash verify-backup.sh

# Deploy future code updates (zero-downtime)
bash deploy.sh
```
