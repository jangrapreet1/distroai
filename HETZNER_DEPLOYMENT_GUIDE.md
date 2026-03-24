# DistroAI — Hetzner Deployment Guide (Docker Compose)

Congratulations! You are ready to launch DistroAI on a single Hetzner server. We'll be using the automated `setup-server.sh` and `deploy.sh` scripts located in your `infra/docker` folder.

This setup automatically installs Docker, configures the firewall, enables swap memory, provisions a secure `distroai` user, and launches your Postgres database, Redis cache, BullMQ worker, NestJS API, Next.js Frontend, and a Caddy reverse proxy with automatic SSL.

## Prerequisites
1. A **Hetzner Cloud** account.
2. A new **Ubuntu 22.04 or 24.04** server created on Hetzner (CX21 or CPX21 instances, min 4GB RAM is recommended, but code works on 2GB).
3. A domain name (e.g., `distroai.com`) pointing to your Hetzner server's public IP address.

---

## Step 1: Initial Server Setup

From your **local computer's terminal** (inside your project directory), run the automated initial setup script. This configures the bare server and creates a secure user profile.

```bash
# Replace <server-ip> with your Hetzner server's public IP
ssh root@<server-ip> 'bash -s' < infra/docker/setup-server.sh
```

---

## Step 2: Clone & Configure

Once the setup script finishes, SSH into the new secure `distroai` user:

```bash
ssh distroai@<server-ip>
```

Navigate to the app directory and clone your repository (or copy the files over if it's a private repo):

```bash
cd /home/distroai/app
git clone https://github.com/your-username/distroai.git .
```

Now, copy the example environment file and edit the secrets:

```bash
cp infra/docker/.env.production.example infra/docker/.env.production
nano infra/docker/.env.production
```

> **Important Variables to Set:**
> - `DOMAIN`: The domain name you pointed to the server in your DNS settings (e.g., `distroai.com`).
> - `POSTGRES_PASSWORD`: Make this secure.
> - `JWT_SECRET` & `JWT_REFRESH_SECRET`: Generate strong random strings.
> - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google SSO (set `GOOGLE_CALLBACK_URL` to `https://yourdomain.com/api/v1/auth/google/callback`).

---

## Step 3: Deploy

With the `.env.production` file saved, simply run the deployment script.

```bash
cd infra/docker
bash deploy.sh
```

This script will automatically:
- Build the `web`, `api`, and `worker` Docker images.
- Spin up `postgres` and `redis`.
- Run your Prisma database migrations (`npx prisma migrate deploy` / `db push`).
- Start the entire application stack.
- Provision a free SSL certificate via Caddy automatically.

---

## Step 4: Verification

Within 1-2 minutes, you can open your browser to `https://yourdomain.com` and you will see your live DistroAI dashboard.

If you ever need to restart the server or check logs, the deploy script will output useful commands for you, such as:
```bash
# Check status of all containers
docker compose -f docker-compose.prod.yml ps

# View scrolling logs of the API
docker compose -f docker-compose.prod.yml logs -f api
```

**Happy Launching! 🚀**
