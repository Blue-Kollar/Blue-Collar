# BlueCollar Deployment Guide: Staging & Production

This guide documents the end-to-end deployment architecture and operational workflows for the BlueCollar platform, bridging cloud infrastructure provisioning via **Terraform** and Kubernetes application deployments via **Helm**.

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |   Cloudflare / Route53 DNS  |
                      +--------------+--------------+
                                     |
                      +--------------v--------------+
                      |       AWS ALB / Ingress     |
                      |  (cert-manager TLS / HTTPS) |
                      +--------------+--------------+
                                     |
                      +--------------v--------------+
                      |  EKS / Kubernetes Cluster   |
                      |  (deploy/helm/bluecollar)   |
                      |  - API Replicas (HPA)       |
                      |  - Next.js Web App          |
                      +-------+-------------+-------+
                              |             |
            +-----------------v-+         +-v-------------------+
            |  AWS RDS Postgres |         |  ElastiCache Redis  |
            |  (terraform RDS)  |         |  (terraform Cache)  |
            +-------------------+         +---------------------+
```

The deployment lifecycle is divided into two distinct tiers:
1. **Infrastructure Tier (`terraform/`)**: Provisions foundational cloud infrastructure (VPC, Subnets, RDS PostgreSQL, ElastiCache Redis, S3 Storage Buckets, and AWS Secrets Manager).
2. **Workload Tier (`deploy/helm/`)**: Packages and deploys containerized services to Kubernetes with health checks, horizontal autoscaling, TLS termination, and observability.

---

## 2. Infrastructure Provisioning with Terraform

Terraform configurations are segregated by environment under `terraform/environments/`.

### 2.1 Environment Comparison

| Resource / Parameter | Staging (`terraform/environments/staging`) | Production (`terraform/environments/production`) |
| :--- | :--- | :--- |
| **AWS Region** | `us-east-1` | `us-east-1` |
| **State Storage** | S3: `blue-collar-terraform-state` (key: `staging/terraform.tfstate`) | S3: `blue-collar-terraform-state` (key: `production/terraform.tfstate`) |
| **State Locking** | DynamoDB: `terraform-locks` | DynamoDB: `terraform-locks` |
| **VPC CIDR** | `10.0.0.0/16` | `10.0.0.0/16` |
| **RDS Instance Class** | `db.t3.micro` | `db.t3.medium` |
| **RDS Storage** | 20 GB (Fixed) | 50 GB (Autoscaling up to 200 GB) |
| **RDS Multi-AZ** | `false` | `true` |
| **RDS Deletion Protection**| `false` | `true` |
| **RDS Backup Retention** | 0 days (Skip final snapshot) | 30 days (Final snapshot enabled) |
| **ElastiCache Redis** | `cache.t3.micro` (1 node) | `cache.t3.medium` (2 nodes) |
| **S3 Storage Versioning** | Enabled | Enabled |

### 2.2 Terraform Provisioning Workflow

#### Step 1: Initialize Terraform
Navigate to the target environment directory and initialize the remote backend:

```bash
# For Staging
cd terraform/environments/staging
terraform init

# For Production
cd terraform/environments/production
terraform init
```

#### Step 2: Validate and Plan
Generate and inspect the execution plan:

```bash
terraform validate
terraform plan -out=tfplan
```

#### Step 3: Apply Infrastructure Changes
Apply the plan once reviewed:

```bash
terraform apply tfplan
```

---

## 3. Application Deployment with Helm (`deploy/helm/bluecollar`)

The application deployment is managed via the Helm chart located at `deploy/helm/bluecollar/`.

### 3.1 Chart Configuration & Values

Key configuration values defined across `values.yaml` and `values-staging.yaml`:

| Parameter | Staging (`values-staging.yaml`) | Production (`values.yaml`) | Description |
| :--- | :--- | :--- | :--- |
| `replicaCount` | `2` | `3` | Base replica count |
| `autoscaling.enabled` | `true` (min: 2, max: 5) | `true` (min: 3, max: 10) | Horizontal Pod Autoscaler |
| `autoscaling.targetCPUUtilizationPercentage` | `70%` | `70%` | CPU target threshold |
| `autoscaling.targetMemoryUtilizationPercentage` | `80%` | `80%` | Memory target threshold |
| `resources.requests` | CPU: `200m`, Mem: `512Mi` | CPU: `250m`, Mem: `256Mi` | Minimum container resources |
| `resources.limits` | CPU: `1000m`, Mem: `1Gi` | CPU: `500m`, Mem: `512Mi` | Maximum container resources |
| `ingress.className` | `nginx` | `nginx` | Ingress controller |
| `ingress.annotations.cert-manager` | `letsencrypt-staging` | `letsencrypt-prod` | Automated TLS issuer |
| `ingress.hosts` | `api-staging.bluecollar.example.com` | `api.bluecollar.io` | Public API domain |
| `livenessProbe.httpGet.path` | `/health` (delay: 30s) | `/health` (delay: 30s) | Health check endpoint |
| `readinessProbe.httpGet.path` | `/ready` (delay: 10s) | `/ready` (delay: 10s) | Ready status endpoint |
| `podSecurityContext.runAsNonRoot` | `true` (uid: 1000) | `true` | Security hardening |

### 3.2 Required Secrets

Before running the deployment, the target Kubernetes namespace must have the required secrets configured:

1. **`bluecollar-secrets` (or `bluecollar-staging-secrets`)**:
   - `DATABASE_URL`: PostgreSQL connection string (formatted as `postgresql://user:pass@host:5432/dbname`)
   - `JWT_SECRET`: Secret key for JWT session verification
   - `STELLAR_SECRET_KEY`: Private signing key for Stellar blockchain operations (testnet/mainnet)
   - `REDIS_URL`: Connection string for ElastiCache Redis

2. **Database & Redis Secrets (if referencing external credentials)**:
   - `staging-db-credentials` (Key: `password`)
   - `staging-redis-credentials` (Key: `password`)

3. **TLS Certificates (`cert-manager`)**:
   - `api-staging-tls` / `bluecollar-tls` (automatically issued by cert-manager via ACME/Let's Encrypt).

### 3.3 Deploying with Helm

#### Staging Deployment:
```bash
helm upgrade --install bluecollar-staging ./deploy/helm/bluecollar \
  --namespace bluecollar-staging \
  --create-namespace \
  -f ./deploy/helm/bluecollar/values-staging.yaml \
  --set image.tag=staging-$(git rev-parse --short HEAD) \
  --set secrets.databaseUrl="${DATABASE_URL}" \
  --set secrets.jwtSecret="${JWT_SECRET}"
```

#### Production Deployment:
```bash
helm upgrade --install bluecollar-prod ./deploy/helm/bluecollar \
  --namespace bluecollar-prod \
  --create-namespace \
  -f ./deploy/helm/bluecollar/values.yaml \
  --set image.tag=v1.0.0 \
  --set secrets.databaseUrl="${PROD_DATABASE_URL}" \
  --set secrets.jwtSecret="${PROD_JWT_SECRET}"
```

---

## 4. Rollback Procedures

If a deployment failure or regression is detected, execute the following rollback steps immediately:

### 4.1 Helm Rollback

1. **Check Release History**:
   ```bash
   helm history bluecollar-prod -n bluecollar-prod
   ```

2. **Identify Last Stable Revision**:
   Locate the previous revision number with `STATUS: deployed`.

3. **Execute Rollback**:
   ```bash
   # Rollback to the previous release (e.g. revision 4)
   helm rollback bluecollar-prod 4 -n bluecollar-prod
   ```

4. **Verify Pod Status & Rollout**:
   ```bash
   kubectl rollout status deployment/bluecollar-prod -n bluecollar-prod
   kubectl get pods -n bluecollar-prod -l app.kubernetes.io/name=bluecollar
   ```

### 4.2 Database Rollback Considerations

- Database migrations must follow the **expand/contract** pattern to allow backward compatibility with prior application revisions.
- If a migration must be reverted:
  ```bash
  # Execute migration down step via API container or migration runner
  pnpm --filter @bluecollar/api db:migrate:down
  ```

### 4.3 GitOps (ArgoCD) Rollback (If Applicable)

If ArgoCD is managing the cluster:
1. Navigate to the ArgoCD UI or use the CLI:
   ```bash
   argocd app rollback bluecollar-app <REVISION_ID>
   ```
2. Disable automated sync temporarily while investigating incidents.

---

## 5. Verification & Observability

Post-deployment validation should verify all telemetry and health indicators:

- **Liveness & Readiness**:
  ```bash
  curl -fsS https://api.bluecollar.io/health
  curl -fsS https://api.bluecollar.io/ready
  ```
- **Prometheus Metrics**: Scraped at `/metrics` (Port `9464`).
- **Grafana Dashboards**: Access system and business overview dashboards at `deploy/grafana/dashboards/`.
- **Jaeger Distributed Traces**: Validate trace spans on HTTP endpoints and database calls.
