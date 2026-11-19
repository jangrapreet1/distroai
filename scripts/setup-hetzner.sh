#!/usr/bin/env bash
set -e

HETZNER_IP="116.202.29.65"
KEY="~/.ssh/id_ed25519"

echo "=== 1. Adding Windows SSH key to authorized_keys on Hetzner ==="
ssh -i $KEY root@$HETZNER_IP "echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFiWlz+JsacHkcjJkfwpyDuNs5jfBFdsoomb+YPD+RIp jangrapreet2003@gmail.com' >> /root/.ssh/authorized_keys"

echo "=== 2. Running setup-server.sh on Hetzner ($HETZNER_IP) ==="
ssh -i $KEY root@$HETZNER_IP 'bash -s' < /home/preet/projects/distroai/infra/docker/setup-server.sh

echo "=== 3. Ensuring distroai user has both authorized keys and sudo access ==="
ssh -i $KEY root@$HETZNER_IP << 'EOF'
cp /root/.ssh/authorized_keys /home/distroai/.ssh/authorized_keys
chown -R distroai:distroai /home/distroai/.ssh
chmod 600 /home/distroai/.ssh/authorized_keys

# Allow distroai user passwordless sudo for docker and systemctl
echo "distroai ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/distroai
chmod 440 /etc/sudoers.d/distroai
EOF

echo "=== 4. Verifying Docker on Hetzner ==="
ssh -i $KEY root@$HETZNER_IP "docker --version && docker compose version && ufw status && free -h"

echo "=== Hetzner Server Provisioning Complete! ==="
