# =============================================================
# RDS PostgreSQL 15 with pgvector
# =============================================================

resource "aws_db_subnet_group" "main" {
  name       = "distroai-db-subnet"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "distroai-db-subnet"
  }
}

resource "aws_db_parameter_group" "postgres15" {
  family = "postgres15"
  name   = "distroai-pg15"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries slower than 1s
  }
}

resource "aws_db_instance" "main" {
  identifier     = "distroai-prod"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Storage
  allocated_storage     = 100
  max_allocated_storage = 500  # Auto-scaling
  storage_type          = "gp3"
  storage_encrypted     = true

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # High availability (disabled for cost — enable when revenue justifies)
  multi_az = false

  # Backup
  backup_retention_period = 7
  backup_window           = "20:30-22:30"  # Sunday 2-4 AM IST

  # Maintenance
  maintenance_window = "Sun:22:30-Mon:00:30"

  # Parameter group
  parameter_group_name = aws_db_parameter_group.postgres15.name

  # Protection
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "distroai-final-${formatdate("YYYY-MM-DD", timestamp())}"

  tags = {
    Name = "distroai-prod"
  }
}
