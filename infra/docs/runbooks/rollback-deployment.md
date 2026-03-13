# Runbook: Rollback Deployment

## When to Rollback
- New deploy causes 5xx errors
- Health check fails after deploy
- User-facing features broken

## Steps

### 1. Quick Rollback (< 1 minute)
```bash
# Rollback API to previous version
kubectl rollout undo deployment/api -n distroai
kubectl rollout status deployment/api -n distroai --timeout=120s

# Rollback web
kubectl rollout undo deployment/web -n distroai

# Rollback worker
kubectl rollout undo deployment/worker -n distroai
```

### 2. Verify Rollback
```bash
# Check pods are running
kubectl get pods -n distroai

# Health check
curl -sf https://api.distroai.in/health
curl -sf https://app.distroai.in

# Check which image is running
kubectl get deployment api -n distroai -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### 3. Rollback to Specific Version
```bash
# List rollout history
kubectl rollout history deployment/api -n distroai

# Rollback to specific revision
kubectl rollout undo deployment/api -n distroai --to-revision=3
```

### 4. Database Rollback (if schema changed)
⚠️ Prisma migrations cannot be automatically reversed. If the migration is destructive:
1. Restore from RDS snapshot (see `restore-database.md`)
2. Deploy previous API version that matches the old schema

## Post-Rollback
- Notify team in #engineering Slack channel
- Create incident report
- Fix the issue in a new branch, test in staging, then re-deploy
