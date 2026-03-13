# Redis in Production

**DO NOT run Redis in Kubernetes for production.**

Use **AWS ElastiCache** (configured in `infra/terraform/elasticache.tf`):
- Redis 7 with encryption at rest + in transit
- cache.t3.micro (0.5GB) — adequate for sessions + BullMQ queues
- 3-day snapshot retention
- LRU eviction policy

Connection string is provided via `api-secrets` Kubernetes secret (`REDIS_URL`).
