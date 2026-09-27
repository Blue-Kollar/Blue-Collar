# Production Environment Variables
environment = "production"
project_name = "blue-collar"

# Networking
vpc_cidr = "10.0.0.0/16"
admin_cidrs = ["0.0.0.0/0"]

# Database
database_name = "bluecollar_production"
database_username = "bluecollar"
instance_class = "db.t3.medium"
allocated_storage = 50
multi_az = true
deletion_protection = true
backup_retention_period = 30

# Cache
node_type = "cache.t3.medium"
num_cache_nodes = 2
