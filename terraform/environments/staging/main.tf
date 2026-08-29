terraform {
  backend "s3" {
    bucket         = "blue-collar-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  environment = "staging"
  project     = "blue-collar"
}

module "networking" {
  source = "../../modules/networking"

  environment     = local.environment
  project_name    = local.project
  vpc_cidr        = "10.0.0.0/16"
  admin_cidrs     = ["203.0.113.0/24"]  # Replace with your IP
}

module "database" {
  source = "../../modules/database"

  environment          = local.environment
  project_name         = local.project
  private_subnet_ids   = module.networking.private_subnet_ids
  security_group_id    = module.networking.db_security_group_id
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  deletion_protection  = false
  skip_final_snapshot  = true
}

module "cache" {
  source = "../../modules/cache"

  environment          = local.environment
  project_name         = local.project
  private_subnet_ids   = module.networking.private_subnet_ids
  security_group_id    = module.networking.redis_security_group_id
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
}

module "storage" {
  source = "../../modules/storage"

  environment        = local.environment
  project_name       = local.project
  versioning_enabled = true
}

module "secrets" {
  source = "../../modules/secrets"

  environment       = local.environment
  project_name      = local.project
  database_host     = module.database.database_address
  database_port     = module.database.database_port
  database_name     = module.database.database_name
  database_username = module.database.database_username
  database_password = module.database.database_password
  redis_host        = module.cache.redis_address
  redis_port        = module.cache.redis_port
}
