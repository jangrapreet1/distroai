# =============================================================
# ElastiCache Redis 7 — session cache + BullMQ queues
# =============================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "distroai-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_parameter_group" "redis7" {
  family = "redis7"
  name   = "distroai-redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "distroai-redis"
  description          = "DistroAI Redis — sessions + queues"

  node_type            = var.redis_node_type
  num_cache_clusters   = 1  # Single node (enable replicas when scaling)
  port                 = 6379
  engine_version       = "7.0"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  parameter_group_name = aws_elasticache_parameter_group.redis7.name

  # Backup
  snapshot_retention_limit = 3
  snapshot_window          = "03:00-05:00"  # IST 8:30-10:30 AM (low traffic)

  # Failover (disabled for cost)
  automatic_failover_enabled = false
  multi_az_enabled           = false

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Name = "distroai-redis"
  }
}
