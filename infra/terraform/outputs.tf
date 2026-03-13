# =============================================================
# Outputs
# =============================================================

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_ca" {
  description = "EKS cluster CA certificate (base64)"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_connection_string" {
  description = "Full DATABASE_URL for the API"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_connection_string" {
  description = "Full REDIS_URL for the API"
  value       = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive   = true
}

output "s3_files_bucket" {
  description = "S3 bucket for application files"
  value       = aws_s3_bucket.files.bucket
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "ecr_registry" {
  description = "ECR registry URL"
  value       = split("/", values(aws_ecr_repository.services)[0].repository_url)[0]
}

output "github_deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions"
  value       = aws_iam_role.github_deploy.arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}
