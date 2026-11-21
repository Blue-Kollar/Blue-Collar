# deploy/ — Infrastructure, Deployment, and Operations

## Structure

| Directory | Purpose | CI? |
|-----------|---------|-----|
| `backups/` | DB backup and restore-drill scripts (referenced by `DB_BACKUPS.yml` CI) | ✅ Yes |
| `terraform/` | Canonical Terraform IaC (backend, provider, modules) | Manual ops |
| `k8s/` | Kubernetes manifests | Manual ops |
| `helm/` | Helm charts | Manual ops |
| `nginx/` | Nginx reverse-proxy config | Manual ops |
| `grafana/` | Grafana dashboards and datasources | Manual ops |
| `prometheus/` | Prometheus scrape configs and alerting rules | Manual ops |
| `alertmanager/` | Alertmanager routing config | Manual ops |
| `jaeger/` | Jaeger distributed tracing config | Manual ops |
| `otel/` | OpenTelemetry Collector config | Manual ops |
| `logstash/` | Logstash pipeline config | Manual ops |
| `vault/` | Vault server and agent configs | Manual ops |
| `monitoring/` | Monitoring manifests | Manual ops |
| `argocd/` | ArgoCD GitOps configs | Manual ops |
| `load-tests/` | Load test scenarios | Manual ops |

## Removed in issue #1899

The following were removed as unreferenced dead files:

- `deploy/scripts/` — 16 shell scripts (backup, deploy, rollback, rotate, smoke-test,
  setup-vault, switch-traffic, monitor-deployment) that were never referenced in any
  CI workflow, package.json script, or operational runbook. The CI backup workflow uses
  `deploy/backups/backup.sh` and `deploy/backups/restore-drill.sh` instead.

## Terraform directories

There are two Terraform root directories in this repository:

1. `terraform/` (repo root) — core infrastructure modules (VPC, RDS, S3, CDN, ECS).
2. `deploy/terraform/` — deployment-focused modules (networking, database, registry,
   CDN, autoscaling, cost-alerts, disaster recovery).

Both are manual-ops only (no automated CI pipeline). Neither directory is stale —
each has unique modules. If you apply Terraform, use the directory whose modules
match your target environment.
