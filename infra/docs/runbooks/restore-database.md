# Runbook: Restore Database

## When to Restore
- Data corruption detected
- Accidental deletion of critical data
- Failed migration that cannot be reversed
- Disaster recovery

## Option 1: Restore from RDS Automated Snapshot (Recommended)

### Steps
```bash
# 1. List available snapshots
aws rds describe-db-snapshots --db-instance-identifier distroai-prod --query 'DBSnapshots[].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}' --output table

# 2. Restore to a new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier distroai-prod-restored \
  --db-snapshot-identifier <snapshot-id> \
  --db-instance-class db.t3.medium \
  --vpc-security-group-ids <rds-sg-id> \
  --db-subnet-group-name distroai-db-subnet

# 3. Wait for instance to be available (~10-15 minutes)
aws rds wait db-instance-available --db-instance-identifier distroai-prod-restored

# 4. Verify data in restored instance
psql -h <restored-endpoint> -U distroai_admin -d distroai -c "SELECT count(*) FROM orders;"

# 5. Update DNS/config to point to restored instance
# Update DATABASE_URL in AWS Secrets Manager

# 6. Restart API pods to pick up new connection
kubectl rollout restart deployment/api -n distroai
kubectl rollout restart deployment/worker -n distroai
```

## Option 2: Restore from S3 Backup (pg_dump)

### Steps
```bash
# 1. List available backups
aws s3 ls s3://distroai-prod-backups/daily/ --human-readable

# 2. Download backup
aws s3 cp s3://distroai-prod-backups/daily/distroai-backup-2026-03-05_0100.sql.gz /tmp/

# 3. Decompress
gunzip /tmp/distroai-backup-*.sql.gz

# 4. Restore to RDS
psql -h <rds-endpoint> -U distroai_admin -d distroai < /tmp/distroai-backup-*.sql
```

## Post-Restore
- Verify all tables have expected row counts
- Run Prisma migrations if schema has drifted: `npx prisma migrate deploy`
- Test critical flows: login, create order, create payment
- Notify team and create incident report
- Verify backup CronJob is still running
