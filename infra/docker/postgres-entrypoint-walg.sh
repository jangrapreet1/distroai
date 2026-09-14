#!/bin/bash
set -e

echo "🚀 Starting Postgres with WAL-G PITR Backups..."

# Dump environment variables so the backup cronjob has access to AWS/B2 keys.
env | grep -E '^AWS_|^WALG_|^PG' > /etc/wal-g.env
chmod 0600 /etc/wal-g.env

# Ensure log file exists and has correct ownership
touch /var/log/wal-g.log
chown postgres:postgres /var/log/wal-g.log

# Start cron daemon in the background
service cron start

# Ensure permissions on the postgres data directory are correct before starting
chown -R postgres:postgres /var/lib/postgresql/data || true

# Hand over execution to the official postgres docker-entrypoint.sh script
exec docker-entrypoint.sh "$@"
