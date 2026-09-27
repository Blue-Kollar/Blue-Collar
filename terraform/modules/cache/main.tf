# Cache Module - ElastiCache Redis

resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.environment}-redis-subnet-group"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-redis-subnet-group"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.environment}-${var.project_name}-redis"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.security_group_id]

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis"
    Environment = var.environment
    Project     = var.project_name
  }
}
