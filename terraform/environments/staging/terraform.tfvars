# Staging Environment Variables
environment = "staging"
project_name = "blue-collar"

# Networking
vpc_cidr = "10.0.0.0/16"
admin_cidrs = ["0.0.0.0/0"]

# Database
database_name = "bluecollar_staging"
database_username = "bluecollar"
instance_class = "db.t3.micro"
allocated_storage = 20

# Cache
node_type = "cache.t3.micro"
num_cache_nodes = 1
