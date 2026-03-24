#!/bin/bash
# ─────────────────────────────────────────────────────────
# DistroAI — First-time Server Setup Script
# Run this ONCE on a fresh Ubuntu 22.04+ VPS
# Usage: ssh root@your-server-ip 'bash -s' < setup-server.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

echo "🚀 DistroAI — Server Setup"
echo "═══════════════════════════"

# 1. System updates
echo "📦 Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

# 3. Install Docker Compose plugin
echo "🔧 Verifying Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi
echo "✅ Docker Compose: $(docker compose version --short)"

# 4. Create app user (non-root)
echo "👤 Creating distroai user..."
if ! id "distroai" &>/dev/null; then
    useradd -m -s /bin/bash -G docker distroai
    mkdir -p /home/distroai/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/distroai/.ssh/
    fi
    chown -R distroai:distroai /home/distroai/.ssh
    chmod 700 /home/distroai/.ssh
    chmod 600 /home/distroai/.ssh/authorized_keys 2>/dev/null || true
    echo "✅ User 'distroai' created with SSH keys copied"
else
    echo "✅ User 'distroai' already exists"
fi

# 5. Set up project directory
echo "📁 Setting up project directory..."
mkdir -p /home/distroai/app
chown -R distroai:distroai /home/distroai/app

# 6. Configure firewall
echo "🔒 Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo "✅ Firewall configured (22, 80, 443 open)"
fi

# 7. Enable swap (important for 1GB RAM servers)
echo "💾 Setting up swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ 2GB swap enabled"
else
    echo "✅ Swap already configured"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  git clone <your-repo-url> /home/distroai/app"
echo "  2. Copy env file:    cp infra/docker/.env.production.example infra/docker/.env.production"
echo "  3. Edit env file:    nano infra/docker/.env.production"
echo "  4. Deploy:           cd infra/docker && bash deploy.sh"
echo "═══════════════════════════════════════════════════════"
