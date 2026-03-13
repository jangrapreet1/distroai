# PostgreSQL in Production

**DO NOT run PostgreSQL in Kubernetes for production.**

Use **AWS RDS** (configured in `infra/terraform/rds.tf`):
- PostgreSQL 15 with pgvector extension
- db.t3.medium (2 vCPU, 4GB)
- 100GB gp3 storage with auto-scaling to 500GB
- 7-day automated backup retention
- Encrypted at rest

Connection string is provided via `api-secrets` Kubernetes secret (`DATABASE_URL`).
