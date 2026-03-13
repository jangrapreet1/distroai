# Runbook: Database Connection Exhausted

## Symptoms
- Prometheus alert: `DatabaseConnectionsHigh` (warning at 150/200)
- API returning 500 errors with "too many connections" messages
- Slow response times across all endpoints

## Diagnosis
```bash
# Check current connections
kubectl exec -it deploy/pgbouncer -n distroai -- psql -h RDS_HOST -U distroai_admin -c "SELECT count(*) FROM pg_stat_activity;"

# Check long-running queries
kubectl exec -it deploy/pgbouncer -n distroai -- psql -h RDS_HOST -U distroai_admin -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 20;"

# Check PgBouncer stats
kubectl exec -it deploy/pgbouncer -n distroai -- psql -p 6432 pgbouncer -c "SHOW POOLS;"
```

## Resolution Steps
1. **Kill long-running queries** (> 5 minutes):
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE duration > interval '5 minutes' AND state = 'active';
   ```
2. **Restart PgBouncer** to reset pool:
   ```bash
   kubectl rollout restart deployment/pgbouncer -n distroai
   ```
3. **Increase max_connections** in RDS parameter group (requires reboot window)
4. **Scale up RDS** to a larger instance class if persistent

## Prevention
- Monitor `pg_stat_activity_count` in Grafana
- Set query timeout in PgBouncer: `query_timeout = 30`
- Use connection pooling (PgBouncer) — never connect directly to RDS
