# DistroAI — AWS Cost Estimate (ap-south-1 Mumbai)

## Monthly Infrastructure Costs (Early Stage)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| EKS Cluster (control plane) | 1 cluster | $72 |
| EC2 Nodes (main) | 2× t3.medium (2 vCPU, 4GB) | ~$60 |
| EC2 Nodes (AI) | 1× t3.large (2 vCPU, 8GB) | ~$60 |
| RDS PostgreSQL | db.t3.medium, 100GB gp3 | ~$65 |
| ElastiCache Redis | cache.t3.micro (0.5GB) | ~$14 |
| S3 Storage | ~50GB files + backups | ~$5 |
| CloudFront CDN | 100GB transfer/month | ~$10 |
| NAT Gateway | 1 (single AZ) | ~$35 |
| ALB (via ingress) | 1 load balancer | ~$20 |
| Data Transfer | ~50GB outbound | ~$15 |
| **Total** | | **~$356/month (~₹30,000)** |

## Break-Even Analysis

| Plan | Price/month | Customers needed to cover AWS |
|------|-----------|------------------------------|
| FREE | ₹0 | ∞ (not revenue-generating) |
| STARTER | ₹499 | 60 customers |
| GROWTH | ₹1,499 | 20 customers |
| ENTERPRISE | ₹4,999 | 6 customers |

**Realistic break-even**: 8–9 paying GROWTH customers × ₹1,499 = ₹13,491/month → covers AWS with ~55% gross margin.

## Cost Optimization Strategies (implement as scale increases)

| Strategy | Savings | When to Implement |
|----------|---------|-------------------|
| Graviton (ARM) instances | ~30% on EC2 | After validating ARM compatibility |
| Reserved Instances (1-year) | ~40% on EC2 + RDS | After 6 months of stable usage |
| Spot Instances for AI nodes | ~60% on AI EC2 | AI workloads tolerate interruption |
| Enable RDS Multi-AZ | +$65/month | When revenue justifies (>20 paying customers) |
| S3 Intelligent Tiering | ~20% on S3 | For files older than 90 days |
| CloudFront restrict to India + SEA | ~10% on CDN | If all users are in India |
| Scale down AI nodes to 0 at night | ~40% on AI EC2 | When usage patterns are established |

## Cost at Scale (100 paying customers)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| EKS Cluster | 1 cluster | $72 |
| EC2 Nodes (main) | 4× t3.medium (Reserved) | ~$72 |
| EC2 Nodes (AI) | 2× t3.large (Spot) | ~$48 |
| RDS PostgreSQL | db.t3.large, Multi-AZ, 500GB | ~$260 |
| ElastiCache Redis | cache.t3.small (2GB) | ~$28 |
| S3 + CloudFront | 500GB + 1TB transfer | ~$50 |
| NAT + ALB + Data Transfer | | ~$100 |
| **Total** | | **~$630/month (~₹52,000)** |

**Revenue at 100 GROWTH customers**: ₹1,49,900/month → ~65% gross margin on infrastructure.
