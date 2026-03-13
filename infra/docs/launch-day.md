# DistroAI — Launch Day Guide

## Pre-Launch (T-7 days)
1. Complete all items in `launch-checklist.md`
2. Run k6 load tests against staging environment
3. Train beta customers (10 distributors) with live support
4. Prepare and test rollback plan

---

## Launch Day — Step by Step

### 1. Provision AWS Infrastructure (Terraform)
```bash
cd infra/terraform
terraform init
terraform plan -var="db_password=YOUR_SECURE_PASSWORD" -out=plan.tfplan
terraform apply plan.tfplan
```
Expected: ~15 minutes. VPC, EKS, RDS, ElastiCache, S3, CloudFront all created.

### 2. Configure kubectl
```bash
aws eks update-kubeconfig --name distroai-prod --region ap-south-1
kubectl get nodes  # Verify nodes are Ready
```

### 3. Install Cluster Addons
```bash
# cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# nginx-ingress
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# external-secrets
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets-system --create-namespace

# prometheus + grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f infra/k8s/monitoring/prometheus-values.yaml
```

### 4. Create Secrets
```bash
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name distroai/prod \
  --region ap-south-1 \
  --secret-string file://secrets.json

# Apply secret store + external secret
kubectl apply -f infra/k8s/secrets/secret-store.yaml
kubectl apply -f infra/k8s/secrets/api-external-secret.yaml

# Verify secrets synced
kubectl get secret api-secrets -n distroai
```

### 5. Apply All Kubernetes Manifests
```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/pgbouncer/
kubectl apply -f infra/k8s/network-policies/
kubectl apply -f infra/k8s/ingress/
```

### 6. Run Database Migrations
```bash
# Manually apply first migration
kubectl apply -f infra/k8s/jobs/db-migrate.yaml
kubectl wait --for=condition=complete job/db-migrate -n distroai --timeout=300s
kubectl logs job/db-migrate -n distroai
```

### 7. Deploy Application
```bash
# Set image tags in manifests
export ECR_REGISTRY="YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com"
export IMAGE_TAG="latest"

for f in infra/k8s/api/deployment.yaml infra/k8s/web/deployment.yaml \
         infra/k8s/ai-service/deployment.yaml infra/k8s/worker/deployment.yaml; do
  sed -i "s|\${ECR_REGISTRY}|$ECR_REGISTRY|g; s|\${IMAGE_TAG}|$IMAGE_TAG|g" "$f"
done

kubectl apply -f infra/k8s/api/
kubectl apply -f infra/k8s/web/
kubectl apply -f infra/k8s/ai-service/
kubectl apply -f infra/k8s/worker/
kubectl apply -f infra/k8s/monitoring/alerts.yaml
```

### 8. Verify
```bash
# Wait for all pods
kubectl get pods -n distroai -w

# Wait for rollout
kubectl rollout status deployment/api -n distroai --timeout=300s
kubectl rollout status deployment/web -n distroai --timeout=300s

# Health check
curl https://api.distroai.in/health
curl https://app.distroai.in

# Check logs
kubectl logs -l app=api -n distroai --tail=50
```

### 9. Update DNS
Update Route53 A records with the actual ALB DNS name:
```bash
kubectl get svc -n ingress-nginx  # Get EXTERNAL-IP
# Update route53.tf or manually set api.distroai.in and app.distroai.in
```

### 10. Seed Production Data
```bash
# Create first org via API
curl -X POST https://api.distroai.in/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"DistroAI Demo","email":"admin@distroai.in","password":"..."}'
```

---

## Post-Launch Monitoring (First 48 Hours)
- Watch Grafana dashboards continuously
- Keep Sentry open in a tab
- Have rollback ready: `kubectl rollout undo deployment/api -n distroai`
- Check WhatsApp bot responses on real messages every hour
- Verify daily briefing sent to beta customers at configured time
- Monitor AWS costs in Cost Explorer
