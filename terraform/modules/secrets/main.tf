# Secrets Module - AWS Secrets Manager

resource "aws_secretsmanager_secret" "app" {
  name = "${var.environment}/${var.project_name}/app"

  tags = {
    Name        = "${var.environment}-app-secrets"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    DB_HOST     = var.database_host
    DB_PORT     = var.database_port
    DB_NAME     = var.database_name
    DB_USER     = var.database_username
    DB_PASSWORD = var.database_password
    REDIS_HOST  = var.redis_host
    REDIS_PORT  = var.redis_port
    JWT_SECRET  = random_password.jwt_secret.result
  })
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "api_keys" {
  name = "${var.environment}/${var.project_name}/api-keys"

  tags = {
    Name        = "${var.environment}-api-keys"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id

  secret_string = jsonencode({
    STRIPE_API_KEY   = var.stripe_api_key != "" ? var.stripe_api_key : "sk_test_placeholder"
    STELLAR_API_KEY  = var.stellar_api_key != "" ? var.stellar_api_key : "G_placeholder"
    WEBHOOK_SECRET   = random_password.webhook_secret.result
  })
}

resource "random_password" "webhook_secret" {
  length  = 32
  special = true
}
