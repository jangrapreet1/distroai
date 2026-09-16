#!/bin/bash
# ─────────────────────────────────────────────────────────
# DistroAI — Server Setup Script for Oracle Linux 9 (x86_64)
# Run as: bash setup-oracle-linux.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

echo "🚀 DistroAI — Oracle Linux 9 Server Setup"
echo "══════════════════════════════════════════"

# 1. Update system packages
echo "📦 Updating DNF packages..."
sudo dnf check-update || true
sudo dnf install -y -q curl wget git tar ca-certificates dnf-plugins-core

# 2. Configure 4GB Swap Space (Essential for 1GB RAM VM)
echo "💾 Configuring 4GB swap space to prevent memory OOM..."
if [ ! -f /swapfile ]; then
    sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ 4GB swap enabled"
else
    echo "✅ Swapfile already exists"
fi
free -h

# 3. Install Docker CE & Docker Compose on Oracle Linux 9
echo "🐳 Installing Docker CE..."
if ! command -v docker &> /dev/null; then
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    echo "✅ Docker installed and active"
else
    echo "✅ Docker already installed"
fi

# Add current user to docker group
sudo usermod -aG docker "$USER"

# 4. Open ports 80 & 443 in firewalld & host iptables
echo "🔒 Opening HTTP (80) & HTTPS (443) in firewall..."
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
    echo "✅ firewalld updated with HTTP/HTTPS"
fi

if command -v iptables &> /dev/null; then
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
fi

echo ""
echo "══════════════════════════════════════════"
echo "✅ Oracle Linux 9 setup complete!"
echo "Docker version: $(docker --version 2>/dev/null || sudo docker --version)"
echo "Compose: $(docker compose version 2>/dev/null || sudo docker compose version)"
echo "══════════════════════════════════════════"
