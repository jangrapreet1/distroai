# Runbook: API Down

## Symptoms
- Prometheus alert: `APIDown` (critical)
- Users unable to access app or API
- Health check at `api.distroai.in/health` returns 5xx or times out

## Diagnosis
```bash
# Check pod status
kubectl get pods -n distroai -l app=api

# Check recent events
kubectl describe deployment api -n distroai

# Check logs
kubectl logs -l app=api -n distroai --tail=100 --previous

# Check if nodes are healthy
kubectl get nodes
kubectl top nodes
```

## Resolution Steps
1. **Pods CrashLooping**: Check logs for startup errors (DB connection, missing env vars)
   ```bash
   kubectl logs -l app=api -n distroai --tail=200
   ```
2. **OOMKilled**: Increase memory limits in deployment.yaml
   ```bash
   kubectl describe pod <pod-name> -n distroai | grep -A5 "Last State"
   ```
3. **Node issues**: Check if EKS nodes have capacity
   ```bash
   kubectl describe nodes | grep -A5 "Allocated resources"
   ```
4. **Rollback**: If latest deploy caused the issue
   ```bash
   kubectl rollout undo deployment/api -n distroai
   kubectl rollout status deployment/api -n distroai
   ```
5. **Scale up**: If load-related
   ```bash
   kubectl scale deployment/api -n distroai --replicas=4
   ```

## Escalation
If not resolved within 15 minutes, page on-call engineer via PagerDuty.
