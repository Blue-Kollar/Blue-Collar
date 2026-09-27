# Deployment Topology

This document maps the infrastructure configuration directories and their target environments for the Blue-Collar project.

## Overview

The project uses a combination of:
- **`deploy/`** (18 subdirectories) — deployment configurations and orchestration scripts
- **`terraform/`** — infrastructure-as-code modules and state management

## Deploy Directory Structure

### Core Infrastructure

| Directory | Purpose | Target Environment | Type |
|-----------|---------|-------------------|------|
| `deploy/base` | Base layer configurations | All | Foundation |
| `deploy/helm` | Kubernetes Helm charts | Kubernetes clusters | K8s Deployment |
| `deploy/docker` | Docker build and registry configs | All | Container |
| `deploy/scripts` | Deployment automation scripts | All | Orchestration |

### Environment-Specific

| Directory | Purpose | Target Environment | Type |
|-----------|---------|-------------------|------|
| `deploy/dev` | Development environment config | Local/Development | Environment |
| `deploy/staging` | Staging environment config | Staging cluster | Environment |
| `deploy/production` | Production environment config | Production cluster | Environment |
| `deploy/testing` | Testing-specific deployments | Test environment | Environment |

### Database & Migrations

| Directory | Purpose | Target Environment | Type |
|-----------|---------|-------------------|------|
| `deploy/db` | Database deployment specs | All (env-specific) | Database |
| `deploy/migrations` | Schema migration scripts | All (env-specific) | Database |

### Monitoring & Observability

| Directory | Purpose | Target Environment | Type |
|-----------|---------|-------------------|------|
| `deploy/monitoring` | Monitoring stack config | All | Observability |
| `deploy/logging` | Centralized logging setup | All | Observability |
| `deploy/alerts` | Alert definitions and rules | All | Observability |

### Networking & Security

| Directory | Purpose | Target Environment | Type |
|-----------|---------|-------------------|------|
| `deploy/network` | Network policies and config | All | Infrastructure |
| `deploy/security` | Security policies and secrets management | All | Security |
| `deploy/tls` | TLS/SSL certificate management | All | Security |

### CI/CD

| Directory | Purpose | Target Environment | Type |
|-----------|---------|-------------------|------|
| `deploy/ci` | CI/CD pipeline configurations | CI system | Automation |
| `deploy/github-actions` | GitHub Actions workflows | GitHub | CI/CD |

## Terraform Module Structure

### Root Modules

```
terraform/
├── main.tf                 # Primary infrastructure definition
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── terraform.tfvars        # Variable defaults
├── backend.tf              # State backend configuration
└── versions.tf             # Required Terraform versions
```

### Module Organization

| Module Path | Purpose | State Backend |
|------------|---------|----------------|
| `terraform/modules/networking` | VPC, subnets, routing | Shared (prod state) |
| `terraform/modules/kubernetes` | EKS/AKS cluster management | Per-environment |
| `terraform/modules/database` | RDS, PostgreSQL, backups | Per-environment |
| `terraform/modules/storage` | S3, file storage, CDN | Per-environment |
| `terraform/modules/compute` | EC2, instances, auto-scaling | Per-environment |
| `terraform/modules/security` | IAM, security groups, policies | Shared (prod state) |
| `terraform/modules/monitoring` | CloudWatch, Datadog, dashboards | Per-environment |

### State Management

- **Primary State Backend**: `terraform/environments/prod/terraform.tfstate`
- **Staging State**: `terraform/environments/staging/terraform.tfstate`
- **Development State**: `terraform/environments/dev/terraform.tfstate` (local)

**Remote State Storage**: AWS S3 with state locking via DynamoDB

## Environment Matrix

| Environment | Deploy Dir | Terraform Env | Cluster Type | Data Persistence |
|-------------|-----------|---|---|---|
| Local Development | `deploy/dev` | `dev` | Docker Compose | Local volume |
| Integration Testing | `deploy/testing` | `test` | Kubernetes (Kind) | Ephemeral |
| Staging | `deploy/staging` | `staging` | EKS | RDS PostgreSQL |
| Production | `deploy/production` | `prod` | EKS | RDS PostgreSQL + backups |

## Critical Dependencies

### Cross-Module Dependencies

```
networking (security groups)
    ↓
compute (EC2 instances, auto-scaling)
    ↓
database (RDS instances in VPC)
    ↓
kubernetes (EKS with networking)
    ↓
monitoring (CloudWatch in same VPC)
```

### Deployment Order

1. **Security & Networking**: `terraform apply -target=module.security` + `terraform apply -target=module.networking`
2. **Database**: `terraform apply -target=module.database`
3. **Compute & Kubernetes**: `terraform apply -target=module.kubernetes`
4. **Storage & CDN**: `terraform apply -target=module.storage`
5. **Monitoring**: `terraform apply -target=module.monitoring`
6. **Helm Deployments**: `helm upgrade --install` via `deploy/helm`

## Blast Radius Guide

### High-Risk Changes

| Change | Blast Radius | Mitigation |
|--------|-------------|-----------|
| Networking module (VPC CIDR) | All environments | Plan carefully, backup state |
| Security policies (IAM roles) | All services | Dry-run, test in staging first |
| Database schema migrations | Data loss possible | Backup before `deploy/migrations` |
| Kubernetes cluster config | Service downtime possible | Rolling updates, canary deployments |

### Low-Risk Changes

| Change | Blast Radius | Notes |
|--------|-------------|-------|
| Monitoring rule changes | No impact | Only affects alerting |
| Logging configuration | No impact | Only affects observability |
| DNS/TLS certificate updates | Brief connectivity blips | Plan during maintenance window |
| Scaling policies | Gradual impact | Auto-scaling handles gracefully |

## Common Deployment Tasks

### Deploying to Staging

```bash
# 1. Validate Terraform changes
terraform plan -var-file=environments/staging/terraform.tfvars

# 2. Apply infrastructure
terraform apply -var-file=environments/staging/terraform.tfvars

# 3. Deploy applications
helm upgrade --install -f deploy/helm/staging-values.yaml \
  bluecollar deploy/helm/bluecollar
```

### Deploying to Production

```bash
# 1. Validate with dry-run
terraform plan -var-file=environments/prod/terraform.tfvars -out=prod.plan

# 2. Apply with manual approval
terraform apply prod.plan

# 3. Canary deployment
kubectl set image deployment/bluecollar-api \
  api=bluecollar:v1.2.3 --record
```

### Rolling Back

```bash
# Terraform rollback to previous state
terraform state pull > backup.tfstate
terraform apply -var-file=environments/prod/terraform.tfvars \
  -auto-approve  # Uses previous state snapshot

# Kubernetes rollback
kubectl rollout undo deployment/bluecollar-api
```

## Troubleshooting

### State Lock Contention

If Terraform is locked:

```bash
# Check lock status
terraform state list

# Force unlock (use with caution!)
terraform force-unlock <LOCK_ID>
```

### Orphaned Resources

Run periodic audits to identify resources not tracked by Terraform:

```bash
# List resources in AWS not in Terraform state
aws ec2 describe-instances --query 'Reservations[].Instances[].Tags'
```

## Next Steps

- [ ] Archive/document orphaned `deploy/` directories (file separate cleanup issue)
- [ ] Add per-module documentation to `terraform/modules/*/README.md`
- [ ] Define runbooks for common deployment scenarios
- [ ] Set up automated compliance scanning for infrastructure changes

---

**Last Updated**: 2026-09-25  
**Maintainers**: Infrastructure Team  
**Related Issues**: #1373
