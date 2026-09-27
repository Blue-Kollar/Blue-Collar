output "redis_cluster_id" {
  description = "Redis cluster ID"
  value       = aws_elasticache_cluster.main.cluster_id
}

output "redis_address" {
  description = "Redis endpoint address"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_cluster.main.cache_nodes[0].port
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.cache_nodes[0].port}"
}
