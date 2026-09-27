variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "blue-collar"
}

variable "versioning_enabled" {
  description = "Enable versioning"
  type        = bool
  default     = true
}
