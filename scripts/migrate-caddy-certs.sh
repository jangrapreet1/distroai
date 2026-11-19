#!/usr/bin/env bash
set -e

echo "🔐 Backing up Caddy certificates from Oracle..."
ssh -i ~/.ssh/oci.key opc@144.24.130.2 << 'EOF'
sudo docker run --rm -v docker_caddy_data:/data alpine tar -czf - -C /data . > /tmp/caddy_data.tar.gz
EOF

echo "📥 Downloading Caddy certificates to local..."
scp -i ~/.ssh/oci.key opc@144.24.130.2:/tmp/caddy_data.tar.gz /home/preet/projects/distroai/backups/oracle_20261022_065350/caddy_data.tar.gz

echo "📤 Uploading Caddy certificates to Hetzner..."
scp /home/preet/projects/distroai/backups/oracle_20261022_065350/caddy_data.tar.gz distroai@116.202.29.65:/home/distroai/backups/caddy_data.tar.gz

echo "🚀 Restoring Caddy certificates into Hetzner caddy_data volume..."
ssh distroai@116.202.29.65 << 'EOF'
docker run --rm -v docker_caddy_data:/data -v /home/distroai/backups/caddy_data.tar.gz:/tmp/caddy_data.tar.gz alpine sh -c "tar -xzf /tmp/caddy_data.tar.gz -C /data"
docker restart distroai_caddy
EOF

echo "✅ Certificates transferred and Caddy restarted on Hetzner!"
