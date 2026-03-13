# Phase 7: Production Deployment — AWS EKS, Monitoring, Security, Launch

Phases 1–6 are complete. The entire DistroAI platform is built:
- NestJS API: 17 modules, all integrations, 30/30 tests
- Next.js dashboard: 14 pages, PWA, streaming AI chat
- WhatsApp bot: 7 flows, DB-persisted sessions
- AI brain: LangChain, Prophet, GPT-4o Vision, pgvector
- React Native app: offline-first, MMKV, sync engine, < 30MB APK

Now build Phase 7: production infrastructure, monitoring, security hardening, and launch preparation.

---

## CONTEXT

- Cloud provider: AWS (ap-south-1 / Mumbai region — closest to Indian users)
- Container orchestration: Kubernetes on AWS EKS
- All infra-as-code goes in infra/ directory
- GitHub Actions CI/CD already scaffolded from Phase 1 — extend it
- Domain assumed: distroai.in (replace with actual domain in all configs)

---

## STEP 1 — Directory Structure

```
infra/
  terraform/
    main.tf              — AWS provider, region, backend (S3 state)
    vpc.tf               — VPC, subnets, security groups
    eks.tf               — EKS cluster + node groups
    rds.tf               — RDS PostgreSQL (production DB)
    elasticache.tf       — ElastiCache Redis
    s3.tf                — S3 buckets (app files, backups)
    iam.tf               — IAM roles and policies
    route53.tf           — DNS records
    acm.tf               — SSL certificates
    cloudfront.tf        — CloudFront CDN for Next.js static assets
    variables.tf         — input variables
    outputs.tf           — output values (cluster endpoint, DB URL, etc.)
  k8s/
    namespace.yaml
    secrets/
      api-secrets.yaml        — sealed secrets (DO NOT commit real values)
      instructions.md         — how to seal secrets with kubeseal
    api/
      deployment.yaml
      service.yaml
      hpa.yaml                — horizontal pod autoscaler
    web/
      deployment.yaml
      service.yaml
    ai-service/
      deployment.yaml
      service.yaml
    worker/
      deployment.yaml         — BullMQ worker (same Docker image as API, different CMD)
    ingress/
      ingress.yaml            — nginx ingress controller config
      cert-manager.yaml       — Let's Encrypt TLS
    monitoring/
      prometheus.yaml
      grafana.yaml
      loki.yaml
    postgres/
      NOTE.md                 — "Use RDS in production, not in-cluster Postgres"
    redis/
      NOTE.md                 — "Use ElastiCache in production, not in-cluster Redis"
  docker/
    Dockerfile.api
    Dockerfile.web
    Dockerfile.ai-service
    Dockerfile.worker
    .dockerignore
```

---

## STEP 2 — Dockerfiles (Production-Optimized)

### infra/docker/Dockerfile.api
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN cd apps/api && pnpm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

### infra/docker/Dockerfile.web
Multi-stage Next.js build with standalone output:
```dockerfile
FROM node:20-alpine AS builder
# ... install deps, build with output: 'standalone' in next.config.js
FROM node:20-alpine AS runner
# ... copy .next/standalone, .next/static, public/
EXPOSE 3001
CMD ["node", "server.js"]
```

### infra/docker/Dockerfile.ai-service
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY apps/ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/ai-service/ .
RUN adduser --system --uid 1001 aiuser
USER aiuser
EXPOSE 8000
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### infra/docker/Dockerfile.worker
Same as Dockerfile.api but different CMD:
```dockerfile
CMD ["node", "dist/worker.main.js"]
```
Create apps/api/src/worker.main.ts — bootstraps only the QueueModule (no HTTP server).

---

## STEP 3 — Terraform: AWS Infrastructure

### terraform/vpc.tf
```hcl
# VPC with 3 public + 3 private subnets across ap-south-1a, ap-south-1b, ap-south-1c
# Public subnets: NAT gateway, load balancers
# Private subnets: EKS nodes, RDS, ElastiCache
# Security groups:
#   - eks-nodes: allow traffic from load balancer SG + internal VPC
#   - rds: allow TCP 5432 from eks-nodes SG only
#   - redis: allow TCP 6379 from eks-nodes SG only
```

### terraform/eks.tf
```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "distroai-prod"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    main = {
      instance_types = ["t3.medium"]  # 2 vCPU, 4GB — sufficient for start
      min_size       = 2
      max_size       = 6
      desired_size   = 2
      disk_size      = 50
    }
    ai = {
      instance_types = ["t3.large"]   # 2 vCPU, 8GB — for Prophet + LangChain
      min_size       = 1
      max_size       = 3
      desired_size   = 1
      labels         = { workload = "ai" }
      taints         = [{ key = "workload", value = "ai", effect = "NO_SCHEDULE" }]
    }
  }
}
```

### terraform/rds.tf
```hcl
# RDS PostgreSQL 15 with pgvector extension
# db.t3.medium (2 vCPU, 4GB) — adequate for early traction
# Multi-AZ: false (cost optimization — enable when revenue justifies)
# Storage: 100GB gp3 with auto-scaling to 500GB
# Backup retention: 7 days
# Maintenance window: Sunday 2-4 AM IST (Saturday 20:30-22:30 UTC)
# Parameter group: enable pg_stat_statements, set max_connections=200
# Deletion protection: true
# Final snapshot: true
```

### terraform/elasticache.tf
```hcl
# Redis 7 cluster mode disabled (single node for start)
# cache.t3.micro (0.5GB) — adequate for session cache + queues
# Automatic failover: false (enable with multi-AZ when scaling)
# Snapshot retention: 3 days
```

### terraform/s3.tf
```hcl
# Bucket: distroai-prod-files — invoices, logos, audits, selfies
#   Versioning: enabled
#   Lifecycle: transition to S3-IA after 90 days, Glacier after 365 days
#   CORS: allow GET from app.distroai.in
#   Block all public access: true (serve via signed URLs only)

# Bucket: distroai-prod-backups — database backups
#   Versioning: enabled
#   Lifecycle: delete after 90 days

# Bucket: distroai-terraform-state — Terraform state
#   Versioning: enabled
#   Encryption: AES256
```

### terraform/cloudfront.tf
```hcl
# CloudFront distribution for Next.js static assets (_next/static/*)
# Origin: S3 bucket for static assets
# Price class: PriceClass_200 (covers Asia, not just US — important for Indian users)
# Caching: static assets cached 1 year (immutable with Next.js content hashing)
# Custom error pages: 404 → /404.html
```

---

## STEP 4 — Kubernetes Manifests

### k8s/namespace.yaml
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: distroai
  labels:
    name: distroai
```

### k8s/api/deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: distroai
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0    # zero-downtime deploys
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: ${ECR_REGISTRY}/distroai-api:${IMAGE_TAG}
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: api-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 5
          failureThreshold: 3
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 10"]  # drain connections before shutdown
      terminationGracePeriodSeconds: 30
```

### k8s/api/hpa.yaml
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
  namespace: distroai
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### k8s/ingress/ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: distroai-ingress
  namespace: distroai
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - app.distroai.in
    - api.distroai.in
    secretName: distroai-tls
  rules:
  - host: app.distroai.in
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 3001
  - host: api.distroai.in
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 3000
```

---

## STEP 5 — GitHub Actions CI/CD Pipeline

Extend .github/workflows/ci.yml to include full CD:

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_DB: distroai_test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck          # tsc --noEmit across all packages
      - run: pnpm run lint               # ESLint
      - run: pnpm run test               # Jest unit tests
      - run: pnpm run test:integration   # NestJS integration tests
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/distroai_test
          REDIS_URL: redis://localhost:6379
          JWT_ACCESS_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    strategy:
      matrix:
        service: [api, web, ai-service, worker]
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-south-1
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build and push ${{ matrix.service }}
        env:
          ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -f infra/docker/Dockerfile.${{ matrix.service }} \
            -t $ECR_REGISTRY/distroai-${{ matrix.service }}:$IMAGE_TAG \
            -t $ECR_REGISTRY/distroai-${{ matrix.service }}:latest .
          docker push $ECR_REGISTRY/distroai-${{ matrix.service }}:$IMAGE_TAG
          docker push $ECR_REGISTRY/distroai-${{ matrix.service }}:latest

  deploy:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-south-1
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name distroai-prod --region ap-south-1
      - name: Deploy to EKS
        env:
          IMAGE_TAG: ${{ github.sha }}
          ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}
        run: |
          # Replace image tags in manifests
          sed -i "s|\${ECR_REGISTRY}|$ECR_REGISTRY|g; s|\${IMAGE_TAG}|$IMAGE_TAG|g" infra/k8s/api/deployment.yaml
          # Apply all manifests
          kubectl apply -f infra/k8s/namespace.yaml
          kubectl apply -f infra/k8s/api/
          kubectl apply -f infra/k8s/web/
          kubectl apply -f infra/k8s/ai-service/
          kubectl apply -f infra/k8s/worker/
          kubectl apply -f infra/k8s/ingress/
          # Wait for rollout
          kubectl rollout status deployment/api -n distroai --timeout=300s
          kubectl rollout status deployment/web -n distroai --timeout=300s
      - name: Smoke test
        run: |
          sleep 30
          curl -f https://api.distroai.in/health || exit 1
          echo "Smoke test passed ✓"
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: "Deploy to production: ${{ job.status }} (commit: ${{ github.sha }})"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## STEP 6 — Secrets Management

### Using AWS Secrets Manager + External Secrets Operator

Install External Secrets Operator in EKS:
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

Create SecretStore pointing to AWS Secrets Manager:
```yaml
# k8s/secrets/secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-south-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
```

Create ExternalSecret to pull from AWS Secrets Manager:
```yaml
# k8s/secrets/api-external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
  namespace: distroai
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: api-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: distroai/prod
        property: DATABASE_URL
    # ... all other secrets
```

Create AWS Secrets Manager secret distroai/prod with all env vars.
Document in infra/secrets/instructions.md: how to create/update secrets, how to rotate keys.

---

## STEP 7 — Monitoring Stack

### Prometheus + Grafana

Install via Helm:
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f infra/k8s/monitoring/prometheus-values.yaml
```

NestJS custom metrics (install prom-client):
Add to apps/api/src/metrics/metrics.module.ts:
```typescript
// Counters
const httpRequestsTotal = new Counter({ name: 'http_requests_total', labelNames: ['method','path','status'] });
const ordersCreatedTotal = new Counter({ name: 'orders_created_total', labelNames: ['source','org_plan'] });
const whatsappMessagesTotal = new Counter({ name: 'whatsapp_messages_total', labelNames: ['direction','type'] });
const aiQueriesTotal = new Counter({ name: 'ai_queries_total', labelNames: ['model','language'] });

// Histograms
const httpRequestDuration = new Histogram({ name: 'http_request_duration_ms', labelNames: ['method','path'], buckets: [50,100,200,300,500,1000,2000,5000] });
const aiQueryDuration = new Histogram({ name: 'ai_query_duration_ms', buckets: [500,1000,2000,5000,10000,30000] });

// Gauges
const activeOrgs = new Gauge({ name: 'active_orgs_total' });
const queueDepth = new Gauge({ name: 'bullmq_queue_depth', labelNames: ['queue'] });
```

Expose metrics at GET /metrics (no auth — Prometheus scrapes internally only).

### Grafana Dashboards (create as JSON config files)

Dashboard 1 — Business KPIs:
- Orders per minute (live counter)
- Revenue this month (rolling)
- Active WhatsApp sessions
- AI query rate + latency P50/P95/P99
- Queue depths (all 6 queues)

Dashboard 2 — Infrastructure:
- API pod CPU + memory per pod
- Request rate + error rate (RED metrics)
- HTTP latency heatmap
- Database connection pool utilization
- Redis hit rate + memory

Dashboard 3 — Business Health:
- New org signups per day
- Plan distribution (FREE/STARTER/GROWTH/ENTERPRISE)
- Daily active orgs
- Invoice generation rate
- WhatsApp messages sent/received

### Alerting Rules (Prometheus AlertManager)
```yaml
# infra/k8s/monitoring/alerts.yaml
groups:
- name: distroai.critical
  rules:
  - alert: APIDown
    expr: up{job="distroai-api"} == 0
    for: 1m
    labels: { severity: critical }
    annotations:
      summary: "API is down"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels: { severity: critical }
    annotations:
      summary: "Error rate above 5%"

  - alert: DatabaseConnectionsHigh
    expr: pg_stat_activity_count > 150
    for: 5m
    labels: { severity: warning }

  - alert: QueueBacklog
    expr: bullmq_queue_depth{queue="notification"} > 1000
    for: 10m
    labels: { severity: warning }
    annotations:
      summary: "Notification queue backlog: {{ $value }} jobs"

  - alert: AIServiceDown
    expr: up{job="distroai-ai-service"} == 0
    for: 5m
    labels: { severity: warning }

  - alert: DiskSpaceRunningLow
    expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.10
    for: 5m
    labels: { severity: warning }
```

Alert routes: critical → PagerDuty + Slack, warning → Slack only.

### Loki (Log Aggregation)
Install Loki + Promtail via Helm.
Configure all pods to ship logs to Loki.
Grafana datasource: add Loki.
Create log query shortcuts:
- API errors: `{app="api"} |= "ERROR"`
- WhatsApp events: `{app="api"} |= "whatsapp"`
- Slow queries: `{app="api"} |= "slow query"`

---

## STEP 8 — Sentry Error Tracking

Add to apps/api/src/main.ts:
```typescript
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of requests traced
  integrations: [new Sentry.Integrations.Http({ tracing: true })],
  beforeSend(event) {
    // Strip sensitive data
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization;
    }
    return event;
  }
});
```

Add to apps/web/ (Next.js):
```typescript
// sentry.client.config.ts + sentry.server.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,  // 1% session replay
});
```

Configure Sentry alerts:
- New issue: Slack notification
- Issue regression: email to engineering
- Error spike (> 100 new errors / 5 min): PagerDuty

---

## STEP 9 — Database Production Setup

### Prisma Migration Strategy for Production
```bash
# Never run prisma db push in production
# Always use prisma migrate deploy (applies pending migrations only)
# Run as a Kubernetes Job before deployment:
```

```yaml
# k8s/jobs/db-migrate.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate-${IMAGE_TAG}
  namespace: distroai
spec:
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: ${ECR_REGISTRY}/distroai-api:${IMAGE_TAG}
        command: ["npx", "prisma", "migrate", "deploy"]
        envFrom:
        - secretRef:
            name: api-secrets
```

Run migration job BEFORE rolling out new API pods in deploy step.

### Database Performance
Create infra/docs/db-optimization.md with:

Indexes to verify exist (critical for scale):
```sql
-- Multi-tenant query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_status ON orders(org_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_created ON orders(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_org_salesman ON customers(org_id, salesman_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_org_product ON inventory(org_id, product_id);

-- WhatsApp session lookup (hot path)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_session_org_phone ON whatsapp_sessions(org_id, phone);

-- Payment ageing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_due_status ON invoices(org_id, due_date, status) WHERE status NOT IN ('PAID', 'CANCELLED');

-- pgvector similarity search
CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Connection pooling: Use PgBouncer as a sidecar or AWS RDS Proxy.
Add k8s/pgbouncer/deployment.yaml connecting to RDS.
Configure API to connect to PgBouncer (port 5432) instead of RDS directly.

### Automated Backups
Beyond RDS automated backups, create a CronJob:
```yaml
# k8s/jobs/db-backup.yaml — runs daily at 1 AM IST
# pg_dump → compress → upload to S3 distroai-prod-backups/daily/
# Retention: keep 30 days of daily backups, 12 months of monthly
```

---

## STEP 10 — Security Hardening

### Network Policies (Kubernetes)
```yaml
# k8s/network-policies/default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: distroai
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]

# Then explicitly allow:
# api → postgres, redis, ai-service, external (OpenAI, Meta, Razorpay)
# web → api only
# worker → postgres, redis, external
# ai-service → postgres only
# All ← ingress controller
```

### Pod Security
```yaml
# Add to all deployments:
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: [ALL]
```

### OWASP Security Headers (already in NestJS Helmet, verify all are set):
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### WAF (AWS Web Application Firewall)
Configure AWS WAF on CloudFront / ALB:
- Enable AWS managed rule groups: CommonRuleSet, KnownBadInputsRuleSet, SQLiRuleSet
- Custom rule: block more than 10 failed auth attempts per IP per 5 minutes
- Custom rule: block requests with SQL injection patterns in query params
- Geo-restriction: optionally restrict to India + common VPN exit IPs (configurable)

---

## STEP 11 — Status Page & Uptime Monitoring

### Uptime Robot Configuration (document steps)
Create monitors for:
- https://api.distroai.in/health (every 5 minutes)
- https://app.distroai.in (every 5 minutes)
- WhatsApp webhook (POST verification — every 5 minutes)

Create public status page at status.distroai.in.
Configure: alert owner email + Slack when any monitor goes down.

### Runbooks (infra/docs/runbooks/)
Create these runbooks:
- api-down.md: steps to diagnose and restore API
- db-connection-exhausted.md: how to identify and kill long-running queries, restart pgbouncer
- queue-backlog.md: how to drain or retry failed jobs via Bull Board
- rollback-deployment.md: `kubectl rollout undo deployment/api -n distroai`
- restore-database.md: steps to restore from S3 backup or RDS snapshot

---

## STEP 12 — Performance Validation

Create infra/load-tests/ with k6 scripts:

### k6 tests:

**test-dashboard.js:** 1000 concurrent users hitting GET /api/v1/analytics/dashboard
Target: P95 < 500ms, P99 < 1s, error rate < 0.1%

**test-order-creation.js:** 100 concurrent order creation requests
Target: P95 < 1s, zero inventory corruption (verify final stock counts)

**test-ai-query.js:** 20 concurrent AI queries
Target: P95 < 8s (AI is slow by nature), error rate < 1%

**test-whatsapp.js:** Simulate 500 concurrent WhatsApp webhook deliveries
Target: all return 200 within 2s (Meta requires fast acknowledgment)

Run these tests:
```bash
# Install k6
brew install k6  # or apt-get install k6

# Run load test
k6 run --vus 1000 --duration 60s infra/load-tests/test-dashboard.js
```

Document results in infra/docs/load-test-results.md.

---

## STEP 13 — Launch Checklist (Pre-Launch Validation)

Create infra/docs/launch-checklist.md with every item:

### Security ✓
- [ ] Multi-tenant isolation tested: org A cannot access org B data (run automated test suite)
- [ ] All endpoints require authentication (run: `grep -r "@Public()" apps/api/src` — verify only auth + webhook routes)
- [ ] Rate limiting active and tested (verify 429 returned on excess requests)
- [ ] HTTPS enforced everywhere (HTTP → HTTPS redirect configured)
- [ ] All secrets in AWS Secrets Manager (zero secrets in code or Docker images)
- [ ] WAF enabled on ALB

### Compliance ✓
- [ ] GST invoice legally valid — reviewed by a CA (attach CA review document)
- [ ] E-invoice tested in GSTN sandbox (attach test IRN screenshot)
- [ ] Privacy Policy page live at distroai.in/privacy
- [ ] Terms of Service page live at distroai.in/terms
- [ ] Data Processing Agreement template available for enterprise customers

### Integrations ✓
- [ ] WhatsApp Business Account approved by Meta (not just test number)
- [ ] Razorpay account KYC complete and live (not test mode)
- [ ] SMS (MSG91) DLT registration complete (required for transactional SMS in India)
- [ ] Firebase project configured with correct SHA-1 for Android APK

### Infrastructure ✓
- [ ] Production database on RDS (not Docker)
- [ ] Database backups running and tested (restore drill completed)
- [ ] SSL certificates auto-renewing via cert-manager
- [ ] Monitoring dashboards showing all green
- [ ] Alerts configured and tested (trigger a fake alert, verify Slack received it)
- [ ] Sentry capturing errors (throw a test error, verify in Sentry dashboard)
- [ ] Status page live at status.distroai.in

### Performance ✓
- [ ] Dashboard P95 < 500ms (k6 test result attached)
- [ ] Order creation: 100 concurrent, zero stock corruption (k6 test result attached)
- [ ] Mobile APK size verified < 30MB
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1 (Lighthouse report attached)

### Business ✓
- [ ] Onboarding wizard tested end-to-end (register → first order → first invoice)
- [ ] 14-day trial auto-starts on registration
- [ ] Upgrade flow tested: trial expires → upgrade modal → Razorpay → plan activates
- [ ] WhatsApp bot tested on 5 real phone numbers (non-Meta test numbers)
- [ ] Daily briefing received on owner's WhatsApp at configured time
- [ ] Payment reminder received after creating an overdue invoice

---

## STEP 14 — Cost Estimation & Optimization

Create infra/docs/cost-estimate.md:

### Monthly AWS costs (ap-south-1, early stage):
```
EKS Cluster (control plane):        $72/month
EC2 nodes (2x t3.medium + 1x t3.large): ~$120/month
RDS db.t3.medium (Multi-AZ off):    ~$65/month
ElastiCache cache.t3.micro:         ~$14/month
S3 (50GB files + backups):          ~$5/month
CloudFront (100GB transfer):        ~$10/month
NAT Gateway:                        ~$35/month
ALB:                                ~$20/month
Data transfer:                      ~$15/month
──────────────────────────────────────────────
Total estimate:                     ~$356/month (~₹30,000/month)
```

### Cost optimization strategies (implement as org scales):
- Switch to Graviton (ARM) instances: ~30% savings on EC2
- Reserved instances after 6 months of stable usage: ~40% savings
- Enable RDS Multi-AZ only when revenue justifies
- Use Spot instances for AI workloads (can tolerate interruption)
- S3 intelligent tiering for files older than 90 days
- CloudFront price class: restrict to India + SEA only

Break-even: 8–9 paying GROWTH customers (₹1499 × 9 = ₹13,491) covers AWS costs with 55% margin.

---

## STEP 15 — Launch & Go-Live

### Pre-launch (T-7 days):
1. Complete all checklist items above
2. Load test in staging environment
3. Train beta customers (10 distributors) with live support
4. Prepare rollback plan (tested)

### Launch day:
```bash
# 1. Apply all Terraform (first time)
cd infra/terraform && terraform init && terraform plan && terraform apply

# 2. Configure kubectl
aws eks update-kubeconfig --name distroai-prod --region ap-south-1

# 3. Install cluster addons
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace
helm install external-secrets external-secrets/external-secrets --namespace external-secrets-system --create-namespace

# 4. Create secrets in AWS Secrets Manager
aws secretsmanager create-secret --name distroai/prod --secret-string file://secrets.json

# 5. Apply all K8s manifests
kubectl apply -f infra/k8s/

# 6. Run database migrations
kubectl apply -f infra/k8s/jobs/db-migrate.yaml
kubectl wait --for=condition=complete job/db-migrate --timeout=300s

# 7. Verify health
curl https://api.distroai.in/health
```

### Post-launch monitoring (first 48 hours):
- Watch Grafana dashboard continuously
- Keep Sentry open in a tab
- Have rollback command ready: `kubectl rollout undo deployment/api -n distroai`
- Check WhatsApp bot response on real messages every hour
- Verify daily briefing sent to beta customers at configured time

---

## WHAT TO DELIVER

At end of Phase 7:

1. infra/terraform/ — complete Terraform config for all AWS resources
2. infra/docker/ — production-optimized Dockerfiles for all 4 services
3. infra/k8s/ — complete Kubernetes manifests (deployments, services, ingress, HPA, network policies, monitoring)
4. .github/workflows/ci.yml — full CI/CD: test → build → push to ECR → deploy to EKS → smoke test → Slack notify
5. Prometheus metrics instrumentation in NestJS API
6. Grafana dashboards (JSON) — 3 dashboards
7. Alerting rules for critical and warning conditions
8. Sentry configured in both API and web app
9. k6 load tests + documented results
10. Runbooks for common incidents
11. Complete launch checklist (every item verifiable)
12. Cost estimate document
13. Launch day step-by-step guide

The goal: one engineer can take this repo, run the Terraform + kubectl commands, and have DistroAI live at distroai.in within 4 hours.
