# Runbook: Queue Backlog

## Symptoms
- Prometheus alert: `QueueBacklog` (warning at 1000+ pending jobs)
- Delayed notifications, payment reminders, or WhatsApp messages
- Users reporting "payment reminder not received"

## Diagnosis
```bash
# Check worker pod status
kubectl get pods -n distroai -l app=worker
kubectl logs -l app=worker -n distroai --tail=100

# Check queue depths via API metrics
curl https://api.distroai.in/metrics | grep bullmq_queue_depth
```

## Resolution Steps
1. **Worker crashed**: Restart worker
   ```bash
   kubectl rollout restart deployment/worker -n distroai
   ```
2. **Worker overwhelmed**: Scale up workers
   ```bash
   kubectl scale deployment/worker -n distroai --replicas=3
   ```
3. **Redis full**: Check Redis memory
   ```bash
   # Via ElastiCache console or Redis CLI
   redis-cli INFO memory
   ```
4. **Drain failed jobs** (via Bull Board or programmatically):
   ```bash
   kubectl exec -it deploy/api -n distroai -- node -e "
     const { Queue } = require('bullmq');
     const q = new Queue('notification', { connection: { host: 'redis-host' }});
     q.getFailedCount().then(c => console.log('Failed:', c));
     q.clean(0, 1000, 'failed').then(() => console.log('Cleaned'));
   "
   ```

## Prevention
- Set up HPA for worker deployment based on queue depth metric
- Configure dead letter queue for jobs that fail 3+ times
