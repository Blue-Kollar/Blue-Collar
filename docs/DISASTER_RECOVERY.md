# Disaster Recovery Plan

## Objectives

| Metric                         | Target    |
| ------------------------------ | --------- |
| Recovery Time Objective (RTO)  | ≤ 4 hours |
| Recovery Point Objective (RPO) | ≤ 1 hour  |

## Architecture overview

- Primary region: `us-east-1`
- DR region: `eu-west-1`
- Database: RDS PostgreSQL with automated backups (7-day retention) and cross-region snapshot copy
- Static assets: S3 with cross-region replication
- Container images: ECR replicated to DR region

---

## Failure scenarios and procedures

### 1. Database failure

**Symptoms:** API returns 5xx, DB connection errors in logs.

**Steps:**

1. Check RDS console — confirm instance status.
2. If Multi-AZ failover is in progress, wait up to 2 minutes for automatic promotion.
3. If primary region is unavailable, promote the DR read replica:
   ```bash
   aws rds promote-read-replica \
     --db-instance-identifier bluecollar-production-replica \
     --region eu-west-1
   ```
4. Update `DATABASE_URL` secret in AWS Secrets Manager to point to the new endpoint.
5. Restart API pods: `kubectl rollout restart deployment/bluecollar-api -n bluecollar`
6. Verify health: `curl https://api.bluecollar.app/health`

**RTO estimate:** 15–30 minutes.

---

### 2. Full region failure

**Symptoms:** All services unreachable, AWS console shows region degradation.

**Steps:**

1. Declare incident in Slack `#incidents`.
2. Switch DNS to DR region (Route 53 health-check failover triggers automatically if configured, otherwise manual):
   ```bash
   aws route53 change-resource-record-sets \
     --hosted-zone-id $HOSTED_ZONE_ID \
     --change-batch file://deploy/scripts/dr-dns-failover.json
   ```
3. Promote DR database replica (see §1 step 3).
4. Scale up DR ECS/K8s cluster:
   ```bash
   kubectl config use-context bluecollar-dr
   kubectl scale deployment bluecollar-api --replicas=3 -n bluecollar
   ```
5. Verify smoke tests pass: `bash deploy/scripts/smoke-tests.sh https://dr.bluecollar.app`
6. Communicate status via status page.

**RTO estimate:** 1–2 hours.

---

### 3. Data corruption

**Symptoms:** Unexpected data in DB, application errors referencing invalid records.

**Steps:**

1. Identify the corruption window from application logs.
2. Take an immediate manual snapshot:
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier bluecollar-production \
     --db-snapshot-identifier bluecollar-pre-restore-$(date +%Y%m%d%H%M)
   ```
3. Restore to point-in-time before corruption:
   ```bash
   bash deploy/scripts/restore-database.sh <RESTORE_TIME_UTC>
   ```
4. Validate data integrity, then cut traffic back.

**RTO estimate:** 30–60 minutes.

---

### 4. Container registry unavailable

**Symptoms:** Deployments fail with image pull errors.

**Steps:**

1. Switch image pull to DR ECR region by updating `values.yaml`:
   ```yaml
   image:
     repository: <DR_ECR_URL>/bluecollar-api
   ```
2. Re-deploy: `helm upgrade bluecollar deploy/helm/bluecollar -f values.yaml`

---

## Backup infrastructure (DR region)

Managed via Terraform — see `deploy/terraform/modules/dr/`:

- RDS cross-region read replica
- S3 cross-region replication rule
- ECR replication configuration

---

## DR drill schedule

| Drill                         | Frequency           | Owner             |
| ----------------------------- | ------------------- | ----------------- |
| Database failover simulation  | Quarterly           | Platform team     |
| Full region failover tabletop | Semi-annually       | Engineering leads |
| Backup restore verification   | Monthly (automated) | CI/CD             |

---

## Runbook index

| Scenario                     | Script / Doc                           |
| ---------------------------- | -------------------------------------- |
| Restore database from backup | `deploy/scripts/restore-database.sh`   |
| Verify backup integrity      | `deploy/scripts/verify-backup.sh`      |
| Blue/green rollback          | `deploy/scripts/rollback.sh`           |
| Rotate secrets               | `deploy/scripts/rotate-api-secrets.sh` |
| Full DR failover             | This document §2                       |
