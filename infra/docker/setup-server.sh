#!/bin/bash
# ─────────────────────────────────────────────────────────
# DistroAI — First-time Server Setup Script
# Run this ONCE on a fresh Ubuntu 22.04+ / 24.04+ VPS
# Fully compatible with: Oracle Cloud Always Free (ARM64 / x86),
# Hetzner, Hostinger, DigitalOcean, and AWS EC2.
# Usage: ssh root@your-server-ip 'bash -s' < setup-server.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

echo "🚀 DistroAI — Production Server Hardening"
echo "═════════════════════════════════════════"

# 1. System updates & essential tools
echo "📦 Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git ufw fail2ban ca-certificates gnupg iptables-persistent netfilter-persistent || true

# 2. Configure fail2ban for SSH brute-force defense
echo "🛡️  Enabling fail2ban for SSH..."
systemctl enable fail2ban 2>/dev/null || true
systemctl start fail2ban 2>/dev/null || true
echo "✅ fail2ban configured"

# 3. Install Docker
echo "🐳 Installing Docker Engine..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

# 4. Install Docker Compose plugin
echo "🔧 Verifying Docker Compose plugin..."
if ! docker compose version &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin || true
fi
echo "✅ Docker Compose: $(docker compose version --short 2>/dev/null || echo 'Installed')"

# 5. Create dedicated app user (non-root)
echo "👤 Creating dedicated 'distroai' system user..."
if ! id "distroai" &>/dev/null; then
    useradd -m -s /bin/bash -G docker distroai
    mkdir -p /home/distroai/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/distroai/.ssh/
    fi
    chown -R distroai:distroai /home/distroai/.ssh
    chmod 700 /home/distroai/.ssh
    chmod 600 /home/distroai/.ssh/authorized_keys 2>/dev/null || true
    echo "✅ User 'distroai' created with SSH access"
else
    echo "✅ User 'distroai' already exists"
fi

# 6. Set up project application directory
echo "📁 Initializing /home/distroai/app directory..."
mkdir -p /home/distroai/app
chown -R distroai:distroai /home/distroai/app

# 7. Configure UFW Firewall (Least Privilege)
echo "🔒 Configuring UFW Firewall (Least Privilege)..."
if command -v ufw &> /dev/null; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow OpenSSH
    ufw allow 80/tcp comment 'HTTP Web'
    ufw allow 443/tcp comment 'HTTPS Web'
    # PostgreSQL (5432) and Redis (6379) are explicitly NOT allowed externally
    ufw --force enable
    echo "✅ UFW active: Only 22, 80, 443 open. DB & Redis are internal-only."
fi

# 8. Oracle Cloud specific iptables unblock
# Oracle Linux & Ubuntu on OCI bundle pre-configured iptables rules that drop ports 80 & 443
if command -v iptables &> /dev/null; then
    echo "☁️  Ensuring Oracle Cloud host iptables permit ports 80 & 443..."
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -A INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -A INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    if command -v netfilter-persistent &> /dev/null; then
        netfilter-persistent save 2>/dev/null || true
    fi
    echo "✅ Host iptables open for HTTP/HTTPS"
fi

# 9. Enable swap (prevents OOM on budget or free tier VPS instances)
echo "💾 Checking swap memory..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ 2GB swapfile enabled"
else
    echo "✅ Swap already configured"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Server hardening complete!"
echo ""
echo "Next Steps to Deploy:"
echo "  1. Switch to user:   su - distroai"
echo "  2. Clone codebase:   git clone https://github.com/jangrapreet1/distroai.git /home/distroai/app"
echo "  3. Configure env:    cp /home/distroai/app/infra/docker/.env.production.example /home/distroai/app/infra/docker/.env.production"
echo "                       nano /home/distroai/app/infra/docker/.env.production"
echo "  4. Launch stack:     cd /home/distroai/app/infra/docker && bash deploy.sh"
echo "═══════════════════════════════════════════════════════"
