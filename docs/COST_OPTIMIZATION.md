# Cost Optimization

## Current resource audit

| Resource        | Type                         | Monthly estimate |
| --------------- | ---------------------------- | ---------------- |
| RDS (prod)      | db.t3.medium Multi-AZ        | ~$70             |
| RDS (staging)   | db.t3.micro                  | ~$15             |
| ECS Fargate     | 0.25 vCPU / 0.5 GB × 2 tasks | ~$20             |
| CloudFront + S3 | CDN + assets                 | ~$5              |
| ECR             | Image storage                | ~$2              |
| **Total**       |                              | **~$112/month**  |

## Auto-scaling policies

Managed by `deploy/terraform/modules/autoscaling/`:

- ECS scales out when CPU > 60% or memory > 70% (60s cooldown)
- ECS scales in when utilisation drops (300s cooldown to avoid flapping)
- Staging/non-prod scales to **zero** at 22:00 UTC and back up at 06:00 UTC — saves ~65% of compute cost outside business hours

## Database sizing

- Production: `db.t3.medium` with Multi-AZ — right-sized for current load
- Staging: `db.t3.micro` — sufficient for testing
- Enable RDS Performance Insights (free tier) to identify slow queries before upsizing

## Cost alerts

Managed by `deploy/terraform/modules/cost-alerts/`:

| Alert                                     | Threshold          |
| ----------------------------------------- | ------------------ |
| Actual spend > 80% of monthly budget      | Email notification |
| Forecasted spend > 100% of monthly budget | Email notification |
| RDS CPU > 80% for 10 minutes              | SNS → email        |

Default monthly budget: **$500** (configurable via `monthly_budget_usd` variable).

## Additional strategies

- Use **Savings Plans** for predictable ECS Fargate workloads (up to 66% discount).
- Enable **S3 Intelligent-Tiering** for assets older than 30 days.
- Set **CloudWatch log retention** to 30 days (already configured in CDN module).
- Review **ECR lifecycle policy** — untagged images deleted after 1 day.
- Use **Spot instances** for non-critical batch jobs (seed, migration tests).

# Cost Optimization Guide

## Overview

This guide covers strategies and implementations for optimizing cloud infrastructure costs for the Blue-Collar platform.

## Current Resource Audit

### Compute Resources

- **API Servers**: 3 instances (t3.medium)
- **Worker Nodes**: 5 instances (t3.large)
- **Database**: RDS PostgreSQL (db.t3.large)
- **Cache**: ElastiCache Redis (cache.t3.micro)

### Storage

- **S3 Buckets**:
  - User uploads: ~500GB
  - Backups: ~200GB
  - Logs: ~100GB
- **EBS Volumes**: 1TB total across instances

### Network

- **Data Transfer**: ~2TB/month outbound
- **CloudFront**: ~5TB/month

### Estimated Monthly Costs

- Compute: $800
- Database: $300
- Storage: $150
- Network: $250
- **Total**: ~$1,500/month

## Auto-Scaling Policies

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bluecollar-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bluecollar-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

### Vertical Pod Autoscaler (VPA)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: bluecollar-api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bluecollar-api
  updatePolicy:
    updateMode: 'Auto'
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 100m
          memory: 256Mi
        maxAllowed:
          cpu: 2000m
          memory: 2Gi
```

### Cluster Autoscaler

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler-config
data:
  scale-down-enabled: 'true'
  scale-down-delay-after-add: '10m'
  scale-down-unneeded-time: '10m'
  skip-nodes-with-local-storage: 'false'
  skip-nodes-with-system-pods: 'false'
```

## Database Optimization

### Instance Right-Sizing

**Current**: db.t3.large (2 vCPU, 8GB RAM) - $300/month
**Optimized**: db.t3.medium (2 vCPU, 4GB RAM) - $150/month

**Analysis**:

- Average CPU: 25%
- Average Memory: 45%
- Peak connections: 50 (max 150)

**Recommendation**: Downgrade to db.t3.medium, saving $150/month

### Read Replicas Strategy

- Use read replicas for reporting queries
- Route read-only traffic to replicas
- Scale replicas based on read load

### Query Optimization

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_workers_category_active
ON workers(category, is_active)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_jobs_status_created
ON jobs(status, created_at DESC);

-- Analyze slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY total_time DESC
LIMIT 20;
```

### Connection Pooling

```typescript
// Optimize Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  pool_timeout = 20
  connection_limit = 20  // Reduced from 50
}
```

## Storage Optimization

### S3 Lifecycle Policies

```json
{
  "Rules": [
    {
      "Id": "TransitionOldUploads",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 180,
          "StorageClass": "GLACIER"
        }
      ]
    },
    {
      "Id": "DeleteOldLogs",
      "Status": "Enabled",
      "Expiration": {
        "Days": 90
      },
      "Filter": {
        "Prefix": "logs/"
      }
    },
    {
      "Id": "DeleteIncompleteUploads",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }
  ]
}
```

### Image Optimization

```typescript
// Compress and resize images on upload
import sharp from 'sharp';

export async function optimizeImage(buffer: Buffer) {
  return sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}

// Generate thumbnails
export async function generateThumbnail(buffer: Buffer) {
  return sharp(buffer).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
}
```

### EBS Volume Optimization

- Use gp3 instead of gp2 (20% cost savings)
- Right-size volumes based on actual usage
- Delete unused snapshots older than 30 days

## Network Cost Optimization

### CloudFront Optimization

```typescript
// Cache-Control headers
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// Compress responses
app.use(
  compression({
    threshold: 1024,
    level: 6,
  }),
);
```

### Regional Data Transfer

- Use VPC endpoints for AWS services (avoid NAT gateway costs)
- Keep data transfer within same region
- Use CloudFront for static assets

### API Response Optimization

```typescript
// Pagination to reduce payload size
export async function listWorkers(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  return prisma.worker.findMany({
    take: limit,
    skip: offset,
    select: {
      id: true,
      name: true,
      category: true,
      // Exclude large fields
    },
  });
}

// Field selection
export async function getWorker(id: string, fields?: string[]) {
  const select = fields?.reduce((acc, field) => {
    acc[field] = true;
    return acc;
  }, {} as any);

  return prisma.worker.findUnique({
    where: { id },
    select: select || undefined,
  });
}
```

## Reserved Instances & Savings Plans

### Compute Savings Plan

- Commit to 1-year term for predictable workloads
- Expected savings: 30-40% on compute costs
- Estimated savings: $240/month

### RDS Reserved Instances

- 1-year partial upfront for database
- Expected savings: 35%
- Estimated savings: $105/month

### ElastiCache Reserved Nodes

- 1-year all upfront
- Expected savings: 45%
- Estimated savings: $25/month

## Cost Alerts

### CloudWatch Alarms

```yaml
# Monthly cost alert
- alert: HighMonthlyCost
  expr: aws_billing_estimated_charges > 2000
  for: 1h
  annotations:
    summary: 'Monthly AWS costs exceed $2000'

# Daily cost spike
- alert: DailyCostSpike
  expr: rate(aws_billing_estimated_charges[24h]) > 100
  for: 1h
  annotations:
    summary: 'Daily cost increase exceeds $100'

# Unused resources
- alert: UnusedEBSVolumes
  expr: aws_ebs_volume_idle_time > 604800 # 7 days
  annotations:
    summary: 'EBS volume unused for 7 days'
```

### Budget Configuration

```json
{
  "BudgetName": "BlueCollar-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "1800",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {
    "TagKeyValue": ["Project$BlueCollar"]
  },
  "Notifications": [
    {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE"
    }
  ]
}
```

## Optimization Strategies

### 1. Spot Instances for Non-Critical Workloads

```yaml
# Use spot instances for batch jobs
apiVersion: batch/v1
kind: Job
metadata:
  name: data-processing
spec:
  template:
    spec:
      nodeSelector:
        node.kubernetes.io/instance-type: spot
      tolerations:
        - key: 'spot'
          operator: 'Equal'
          value: 'true'
          effect: 'NoSchedule'
```

### 2. Scheduled Scaling

```yaml
# Scale down during off-peak hours
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bluecollar-api-scheduled
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bluecollar-api
  minReplicas: 1 # Off-peak: 1 replica
  maxReplicas: 3 # Off-peak: max 3 replicas
  # Schedule: 10 PM - 6 AM UTC
```

### 3. Resource Requests Optimization

```yaml
# Right-size resource requests
resources:
  requests:
    cpu: 200m # Reduced from 500m
    memory: 512Mi # Reduced from 1Gi
  limits:
    cpu: 1000m
    memory: 1Gi
```

### 4. Caching Strategy

```typescript
// Aggressive caching for static data
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedWorkers(category: string) {
  const cacheKey = `workers:${category}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const workers = await prisma.worker.findMany({
    where: { category, is_active: true },
  });

  await redis.setex(cacheKey, 3600, JSON.stringify(workers)); // 1 hour TTL
  return workers;
}
```

## Cost Optimization Checklist

- [ ] Audit current resource usage
- [ ] Implement auto-scaling policies
- [ ] Right-size database instances
- [ ] Configure S3 lifecycle policies
- [ ] Enable CloudFront caching
- [ ] Purchase reserved instances
- [ ] Set up cost alerts
- [ ] Optimize API responses
- [ ] Use spot instances for batch jobs
- [ ] Implement aggressive caching
- [ ] Delete unused resources
- [ ] Monitor and iterate

## Expected Savings Summary

| Optimization          | Monthly Savings |
| --------------------- | --------------- |
| Database right-sizing | $150            |
| Compute savings plan  | $240            |
| RDS reserved instance | $105            |
| S3 lifecycle policies | $50             |
| Auto-scaling          | $100            |
| Spot instances        | $80             |
| **Total**             | **$725/month**  |

**New estimated monthly cost**: $775 (48% reduction)

## Monitoring and Reporting

### Cost Dashboard

- Daily cost trends
- Cost by service
- Cost by environment
- Budget vs actual
- Savings from optimizations

### Monthly Review Process

1. Review cost dashboard
2. Identify cost anomalies
3. Analyze resource utilization
4. Implement optimizations
5. Update forecasts

## References

- [AWS Cost Optimization Best Practices](https://aws.amazon.com/pricing/cost-optimization/)
- [Kubernetes Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Database Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
