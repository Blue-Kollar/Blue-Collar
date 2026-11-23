# Staging Environment Guide

## Overview

The staging environment is a production-like environment for testing changes before deploying to production. It mirrors production infrastructure and configuration while using separate resources.

## Architecture

### Infrastructure

- **Kubernetes Cluster**: Dedicated staging cluster
- **Database**: PostgreSQL (smaller instance than production)
- **Cache**: Redis (single node)
- **Storage**: S3 bucket (staging-bluecollar-uploads)
- **CDN**: CloudFront distribution (staging subdomain)

### Domains

- **API**: https://api-staging.bluecollar.example.com
- **Frontend**: https://staging.bluecollar.example.com
- **Admin**: https://admin-staging.bluecollar.example.com

## Deployment

### Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# Install helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Configure kubectl for staging cluster
aws eks update-kubeconfig --name bluecollar-staging --region us-east-1
```

### Deploy Staging Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init

# Select staging workspace
terraform workspace select staging || terraform workspace new staging

# Plan deployment
terraform plan -var-file=environments/staging.tfvars

# Apply changes
terraform apply -var-file=environments/staging.tfvars
```

### Deploy Application

```bash
# Build and push Docker image
docker build -t bluecollar-api:staging -f packages/api/Dockerfile .
docker tag bluecollar-api:staging <registry>/bluecollar-api:staging
docker push <registry>/bluecollar-api:staging

# Deploy with Helm
helm upgrade --install bluecollar-staging deploy/helm/bluecollar \
  --namespace bluecollar-staging \
  --create-namespace \
  --values deploy/helm/bluecollar/values-staging.yaml \
  --set image.tag=staging

# Verify deployment
kubectl get pods -n bluecollar-staging
kubectl get svc -n bluecollar-staging
```

## Configuration

### Environment Variables

```bash
# Staging-specific environment variables
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging-db.example.com:5432/bluecollar
REDIS_URL=redis://staging-redis.example.com:6379
API_URL=https://api-staging.bluecollar.example.com
FRONTEND_URL=https://staging.bluecollar.example.com

# Feature flags
ENABLE_DEBUG_LOGGING=true
ENABLE_EXPERIMENTAL_FEATURES=true
RATE_LIMIT_ENABLED=true

# External services (use test/sandbox accounts)
STELLAR_NETWORK=testnet
STRIPE_API_KEY=sk_test_...
SENDGRID_API_KEY=SG.test...

# Monitoring
JAEGER_ENDPOINT=http://jaeger-staging:14268/api/traces
PROMETHEUS_ENDPOINT=http://prometheus-staging:9090
```

### Helm Values (values-staging.yaml)

```yaml
replicaCount: 2

image:
  repository: <registry>/bluecollar-api
  tag: staging
  pullPolicy: Always

resources:
  requests:
    cpu: 200m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
  hosts:
    - host: api-staging.bluecollar.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: api-staging-tls
      hosts:
        - api-staging.bluecollar.example.com

postgresql:
  enabled: false
  external:
    host: staging-db.example.com
    port: 5432
    database: bluecollar
    existingSecret: staging-db-credentials

redis:
  enabled: false
  external:
    host: staging-redis.example.com
    port: 6379
    existingSecret: staging-redis-credentials

monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
```

## Data Seeding

### Seed Script

```typescript
// packages/api/src/database/seed-staging.ts
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function seedStaging() {
  console.log('Seeding staging database...');

  // Create test admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@staging.bluecollar.example.com',
      password: await hashPassword('staging-admin-password'),
      role: 'ADMIN',
      is_verified: true,
    },
  });

  // Create test workers
  const workers = [];
  for (let i = 0; i < 50; i++) {
    const worker = await prisma.worker.create({
      data: {
        name: faker.person.fullName(),
        category: faker.helpers.arrayElement(['plumber', 'electrician', 'carpenter']),
        wallet_address: faker.finance.ethereumAddress(),
        owner_id: admin.id,
        is_active: true,
        rating: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
      },
    });
    workers.push(worker);
  }

  // Create test jobs
  for (let i = 0; i < 100; i++) {
    await prisma.job.create({
      data: {
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        category: faker.helpers.arrayElement(['plumber', 'electrician', 'carpenter']),
        budget: faker.number.int({ min: 100, max: 5000 }),
        status: faker.helpers.arrayElement(['OPEN', 'IN_PROGRESS', 'COMPLETED']),
        client_id: admin.id,
        worker_id: faker.helpers.arrayElement(workers).id,
      },
    });
  }

  console.log('Staging database seeded successfully');
}

seedStaging()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Run Seeding

```bash
# Seed staging database
npm run seed:staging

# Or via kubectl
kubectl exec -it deployment/bluecollar-api -n bluecollar-staging -- npm run seed:staging
```

## Testing in Staging

### Smoke Tests

```bash
# Run smoke tests against staging
export API_URL=https://api-staging.bluecollar.example.com
npm run test:smoke

# Or use the smoke test script
./deploy/scripts/smoke-tests.sh staging
```

### Integration Tests

```bash
# Run full integration test suite
export NODE_ENV=staging
npm run test:integration
```

### Load Tests

```bash
# Run load tests against staging
cd deploy/load-tests
k6 run --env API_URL=https://api-staging.bluecollar.example.com basic-load-test.js
```

## Staging Deployment Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - develop

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        run: |
          aws ecr get-login-password --region us-east-1 | \
          docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}

      - name: Build and push Docker image
        run: |
          docker build -t bluecollar-api:${{ github.sha }} -f packages/api/Dockerfile .
          docker tag bluecollar-api:${{ github.sha }} ${{ secrets.ECR_REGISTRY }}/bluecollar-api:staging
          docker push ${{ secrets.ECR_REGISTRY }}/bluecollar-api:staging

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --name bluecollar-staging --region us-east-1

      - name: Deploy to staging
        run: |
          helm upgrade --install bluecollar-staging deploy/helm/bluecollar \
            --namespace bluecollar-staging \
            --create-namespace \
            --values deploy/helm/bluecollar/values-staging.yaml \
            --set image.tag=staging \
            --wait

      - name: Run smoke tests
        run: |
          export API_URL=https://api-staging.bluecollar.example.com
          npm run test:smoke

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Staging-Specific Settings

### Rate Limiting

```typescript
// More lenient rate limits for testing
export const stagingRateLimits = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window (vs 100 in production)
};
```

### Debug Logging

```typescript
// Enable verbose logging in staging
export const stagingLogConfig = {
  level: 'debug',
  prettyPrint: true,
  redact: [], // Don't redact sensitive fields in staging
};
```

### Feature Flags

```typescript
// Enable experimental features in staging
export const stagingFeatureFlags = {
  enableNewWorkerSearch: true,
  enableAdvancedFilters: true,
  enableBetaFeatures: true,
};
```

## Monitoring and Observability

### Grafana Dashboards

- Staging API Performance
- Staging Database Metrics
- Staging Error Rates
- Staging User Activity

### Alerts

```yaml
# Staging-specific alerts (less strict than production)
- alert: StagingHighErrorRate
  expr: rate(http_requests_total{env="staging",status=~"5.."}[5m]) / rate(http_requests_total{env="staging"}[5m]) > 0.10
  for: 10m
  annotations:
    summary: 'Staging error rate exceeds 10%'

- alert: StagingHighResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{env="staging"}[5m])) > 2
  for: 10m
  annotations:
    summary: 'Staging p95 response time exceeds 2s'
```

## Access Control

### Staging Access

- Developers: Full access
- QA Team: Full access
- Product Team: Read access
- External stakeholders: Limited access with demo accounts

### Authentication

```bash
# Use staging-specific OAuth credentials
GOOGLE_CLIENT_ID=staging-client-id
GOOGLE_CLIENT_SECRET=staging-client-secret
GOOGLE_CALLBACK_URL=https://api-staging.bluecollar.example.com/auth/google/callback
```

## Data Management

### Database Refresh

```bash
# Refresh staging database from production (sanitized)
./deploy/scripts/refresh-staging-db.sh

# This script:
# 1. Takes production backup
# 2. Sanitizes sensitive data (emails, passwords, etc.)
# 3. Restores to staging database
# 4. Runs migrations
# 5. Seeds additional test data
```

### Data Retention

- Staging data is reset weekly
- Logs retained for 7 days
- Backups retained for 7 days

## Troubleshooting

### Common Issues

**Issue**: Pods not starting

```bash
# Check pod status
kubectl get pods -n bluecollar-staging

# Check pod logs
kubectl logs -f deployment/bluecollar-api -n bluecollar-staging

# Describe pod for events
kubectl describe pod <pod-name> -n bluecollar-staging
```

**Issue**: Database connection errors

```bash
# Verify database credentials
kubectl get secret staging-db-credentials -n bluecollar-staging -o yaml

# Test database connection
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h staging-db.example.com -U user -d bluecollar
```

**Issue**: High response times

```bash
# Check resource usage
kubectl top pods -n bluecollar-staging

# Check HPA status
kubectl get hpa -n bluecollar-staging

# Scale manually if needed
kubectl scale deployment bluecollar-api --replicas=5 -n bluecollar-staging
```

## Best Practices

1. **Always test in staging before production**
2. **Keep staging configuration close to production**
3. **Use staging for load testing and performance validation**
4. **Regularly refresh staging data from production (sanitized)**
5. **Monitor staging metrics and alerts**
6. **Document staging-specific configurations**
7. **Use staging for training and demos**

## References

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Helm Chart Development](https://helm.sh/docs/chart_template_guide/)
- [AWS EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/)
