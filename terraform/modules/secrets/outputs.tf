output "app_secret_arn" {
  description = "App secret ARN"
  value       = aws_secretsmanager_secret.app.arn
}

output "api_keys_secret_arn" {
  description = "API keys secret ARN"
  value       = aws_secretsmanager_secret.api_keys.arn
}
