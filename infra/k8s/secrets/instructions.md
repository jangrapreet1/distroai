# Secrets Management Instructions

## Recommended: AWS Secrets Manager + External Secrets Operator

### 1. Install External Secrets Operator in EKS
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system --create-namespace
```

### 2. Create AWS Secrets Manager Secret
```bash
aws secretsmanager create-secret \
  --name distroai/prod \
  --region ap-south-1 \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "REDIS_URL": "rediss://...",
    "JWT_ACCESS_SECRET": "...",
    "JWT_REFRESH_SECRET": "..."
  }'
```

### 3. Apply ClusterSecretStore + ExternalSecret
```bash
kubectl apply -f infra/k8s/secrets/secret-store.yaml
kubectl apply -f infra/k8s/secrets/api-external-secret.yaml
```

### 4. Verify
```bash
kubectl get secret api-secrets -n distroai -o yaml
```

## Rotating Secrets
```bash
# Update the secret value
aws secretsmanager put-secret-value \
  --secret-id distroai/prod \
  --secret-string '{"DATABASE_URL": "new-value", ...}'

# External Secrets Operator will refresh within 1 hour (configurable)
# To force immediate refresh:
kubectl annotate externalsecret api-secrets -n distroai force-sync=$(date +%s) --overwrite
```

## Alternative: kubectl create secret (manual)
```bash
kubectl create secret generic api-secrets \
  --namespace distroai \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="rediss://..." \
  --from-literal=JWT_ACCESS_SECRET="..." \
  --from-literal=JWT_REFRESH_SECRET="..."
```
