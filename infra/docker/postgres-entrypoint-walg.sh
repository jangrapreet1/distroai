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

# Create wal-push-safe wrapper to handle cases where B2 backup credentials are not yet configured
cat << 'EOF' > /usr/local/bin/wal-push-safe
#!/bin/bash
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ "$AWS_ACCESS_KEY_ID" != "your_b2_application_key_id" ] && [ -n "$WALG_S3_PREFIX" ] && [ "$WALG_S3_PREFIX" != "s3://distroai-prod-backups/walg" ]; then
    exec wal-g wal-push "$1"
else
    # Graceful fallback: return success so Postgres does not accumulate WAL files when B2 is not configured
    exit 0
fi
EOF
chmod +x /usr/local/bin/wal-push-safe

# Hand over execution to the official postgres docker-entrypoint.sh script
exec docker-entrypoint.sh "$@"
