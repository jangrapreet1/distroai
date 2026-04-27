#!/bin/bash
set -e

echo "🚀 Starting Postgres with WAL-G PITR Backups..."

# Dump environment variables so the backup cronjob has access to AWS/B2 keys.
# We strip quotes to avoid xargs parsing issues later.
env | grep -E '^AWS_|^WALG_|^PG' > /etc/wal-g.env

# Start cron daemon in the background
service cron start

# Ensure permissions on the postgres data directory are correct before starting
chown -R postgres:postgres /var/lib/postgresql/data || true
chown -R postgres:postgres /var/log/wal-g.log || true

# Hand over execution to the official postgres docker-entrypoint.sh script
# This script will consume the CMD ["postgres", "-c", "wal_level=logical", ...] arguments dynamically
exec docker-entrypoint.sh "$@"
