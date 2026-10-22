# Production Deployment

This document covers infrastructure, database configuration, connection pooling,
read-replica setup, and scaling guidance for the BlueCollar API.

---

## Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Helm)](#quick-start-helm)
- [Environment variables](#environment-variables)
- [Connection pooling](#connection-pooling)
  - [PgBouncer (recommended for production)](#pgbouncer-recommended-for-production)
  - [Prisma built-in pooling (development / small deployments)](#prisma-built-in-pooling-development--small-deployments)
- [Read-replica setup](#read-replica-setup)
- [Load testing the pool](#load-testing-the-pool)
- [Scaling guidance](#scaling-guidance)
- [Kubernetes deployment](#kubernetes-deployment)
- [Backup and recovery](#backup-and-recovery)
- [Monitoring](#monitoring)

---

## Prerequisites

- Kubernetes cluster (v1.24+)
- Helm 3.0+
- kubectl configured
- Access to container registry
- PostgreSQL 15+ (RDS, Aurora, or self-managed)

---

## Quick Start (Helm)

```bash
# Clone repository
git clone https://github.com/Fidelis900/Blue-Collar.git
cd Blue-Collar

# Install
helm install blue-collar ./deploy/helm/blue-collar \
  --namespace blue-collar \
  --create-namespace \
  --values ./deploy/helm/blue-collar/values/production.yaml

# Upgrade
helm upgrade blue-collar ./deploy/helm/blue-collar \
  --namespace blue-collar \
  --values ./deploy/helm/blue-collar/values/production.yaml

# Uninstall
helm uninstall blue-collar --namespace blue-collar

# Override specific values
helm install blue-collar ./deploy/helm/blue-collar \
  --set api.replicas=3 \
  --set api.resources.limits.memory=1Gi

# Create secrets
kubectl create secret generic blue-collar-secrets \
  --namespace blue-collar \
  --from-literal=db-password=your-password \
  --from-literal=api-key=your-api-key
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Primary (read-write) PostgreSQL connection string |
| `DATABASE_READ_URL` | — | Read-replica connection string (falls back to primary) |
| `DB_POOL_SIZE` | — | Max connections for primary pool (default: `10`) |
| `DB_READ_POOL_SIZE` | — | Max connections for replica pool (default: `20`) |
| `JWT_SECRET` | ✅ | Long random string for JWT signing |
| `REDIS_URL` | ✅ | Redis connection URL for caching and queues |

See `packages/api/.env.example` for the full list.

---

## Connection pooling

### PgBouncer (recommended for production)

PgBouncer in **transaction mode** is the correct choice for a Node.js/Prisma
API that opens many short-lived connections.  Without it, each pod maintains
up to `DB_POOL_SIZE` persistent TCP connections to PostgreSQL — at 10 API
pods this means up to 100 connections even at idle, which exhausts PostgreSQL's
`max_connections` on small instances.

**Architecture:**

```
API pods (N × Prisma, pool_size=1) ──► PgBouncer (pool_size=20–50) ──► PostgreSQL
```

**Connection string format when going through PgBouncer:**

```
postgresql://user:pass@pgbouncer-host:5433/bluecollar?pgbouncer=true&connection_limit=1
```

Key parameters:

| Parameter | Value | Why |
|-----------|-------|-----|
| `pgbouncer=true` | required | Disables Prisma's advisory lock logic which is incompatible with transaction mode |
| `connection_limit=1` | required | One PgBouncer-managed connection per Prisma instance; the pool is at PgBouncer level |

**Recommended PgBouncer settings (`pgbouncer.ini`):**

```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 1000        ; total clients across all pools
default_pool_size = 25        ; server connections to PostgreSQL per user/db pair
reserve_pool_size = 5         ; extra connections for bursts
reserve_pool_timeout = 1      ; seconds to wait before using reserve
server_idle_timeout = 600     ; close idle server connections after 10 min
server_lifetime = 3600        ; recycle server connections after 1 hour
log_connections = 0
log_disconnections = 0
```

**Environment variables to set:**

```dotenv
DATABASE_URL="postgresql://user:pass@pgbouncer:5433/bluecollar?pgbouncer=true&connection_limit=1"
DB_POOL_SIZE=1    # One managed connection per Prisma instance when behind PgBouncer
```

---

### Prisma built-in pooling (development / small deployments)

Without PgBouncer, Prisma uses its own `@prisma/adapter-pg` pool.  The pool
size is controlled by `DB_POOL_SIZE` and `DB_READ_POOL_SIZE`.

**Rule of thumb:**

```
max_connections (PostgreSQL) ≥ (API_PODS × DB_POOL_SIZE) + (REPLICA_PODS × DB_READ_POOL_SIZE) + headroom
```

Example: 3 API pods, `DB_POOL_SIZE=10`, 1 replica client, `DB_READ_POOL_SIZE=20`:

```
3×10 + 1×20 + 10 headroom = 60 connections minimum
```

Set `max_connections = 100` on your PostgreSQL instance.

---

## Read-replica setup

The API ships with a first-class read/write split abstraction in `src/db.ts`:

| Export | Client | Connected to |
|--------|--------|-------------|
| `db` | primary | `DATABASE_URL` |
| `readDb` | replica | `DATABASE_READ_URL` (fallback: `DATABASE_URL`) |
| `getDb('read')` | replica | Same as `readDb` |
| `getDb('write')` | primary | Same as `db` |

**To enable a read replica:**

1. Provision a PostgreSQL read replica (e.g., RDS Read Replica or Aurora
   reader endpoint).
2. Add the replica's connection string to your environment:

```dotenv
DATABASE_READ_URL="postgresql://user:pass@replica.internal:5432/bluecollar"
DB_READ_POOL_SIZE=20
```

3. In services with heavy read paths, use `readDb` or `getDb('read')`:

```typescript
import { readDb } from '../db.js'

// This query hits the replica
const workers = await readDb.worker.findMany({
  where: { isActive: true, deletedAt: null },
  include: { category: true },
})
```

4. Writes always go through `db` (the primary):

```typescript
import { db } from '../db.js'

// This write goes to the primary
const worker = await db.worker.create({ data: { ... } })
```

**Replication lag:** The replica may be 0–500 ms behind the primary. Never
read from `readDb` immediately after a write in the same request — use `db`
for the post-write read if consistency is required.

---

## Load testing the pool

The `packages/api/load/` directory contains k6 scripts for pool stress-testing.

```bash
# Install k6 (https://k6.io/docs/get-started/installation/)
brew install k6   # macOS

# Run the workers load test against localhost
k6 run packages/api/load/workers.js \
  --vus 50 \
  --duration 60s \
  --env BASE_URL=http://localhost:3000

# Run the auth load test
k6 run packages/api/load/auth.js --vus 20 --duration 30s
```

Watch for these signals during a pool load test:

| Signal | Likely cause | Fix |
|--------|-------------|-----|
| `P95 latency > 500 ms` during burst | Pool exhaustion | Increase `DB_POOL_SIZE` or add a replica |
| `Connection pool timeout` errors | Pool too small for concurrency | Increase pool size or scale API pods |
| PostgreSQL `max_connections` exceeded | Too many API pods × pool size | Switch to PgBouncer |

---

## Scaling guidance

### Horizontal scaling (more API pods)

Adding pods multiplies the connection count. Stay within PostgreSQL limits:

1. Check current `max_connections`: `SHOW max_connections;`
2. Calculate headroom: `max_connections − (pods × DB_POOL_SIZE) > 10`
3. If tight, add PgBouncer before scaling further.

### Vertical scaling (larger database instance)

When average query time rises above 20 ms median:

1. Run `EXPLAIN (ANALYZE, BUFFERS)` on the slow queries.
2. Check for missing indexes (`pg_stat_user_indexes` + `pg_stat_user_tables`).
3. If CPU-bound, scale up the database instance.
4. If I/O-bound, provision IOPS or use a storage-optimised instance class.

### Adding a read replica (scale reads)

1. Create the replica and set `DATABASE_READ_URL`.
2. Move `listWorkers`, `advancedSearch`, and analytics endpoints to use
   `getDb('read')` or `readDb`.
3. The replica can typically handle 5–10× the read traffic of a single primary.

### Connection string reference

| Scenario | `DATABASE_URL` format |
|----------|----------------------|
| Direct to PostgreSQL | `postgresql://user:pass@host:5432/db` |
| Via PgBouncer (transaction mode) | `postgresql://user:pass@host:5433/db?pgbouncer=true&connection_limit=1` |
| AWS RDS IAM auth | `postgresql://user@host:5432/db?sslmode=require` (use IAM token rotation) |
| AWS Aurora | Use the cluster endpoint for writes, reader endpoint for `DATABASE_READ_URL` |

---

## Kubernetes deployment

```bash
# Scale the API deployment
kubectl scale deployment blue-collar-api \
  --namespace blue-collar \
  --replicas=5

# Debug a pod
kubectl describe pod <pod-name> --namespace blue-collar
kubectl logs <pod-name> --namespace blue-collar

# Open a psql shell in the database pod
kubectl exec -it <db-pod> --namespace blue-collar -- psql -U blue_collar

# Inspect ingress
kubectl get ingress --namespace blue-collar
kubectl describe ingress blue-collar --namespace blue-collar
```

---

## Backup and recovery

```bash
# Manual backup (from database pod)
kubectl exec -it <db-pod> --namespace blue-collar -- pg_dump -U blue_collar > backup.sql

# Restore
kubectl exec -it <db-pod> --namespace blue-collar -- psql -U blue_collar < backup.sql
```

For automated backup and point-in-time recovery, see
[docs/DATABASE_BACKUP_AND_RECOVERY.md](./DATABASE_BACKUP_AND_RECOVERY.md).

---

## Monitoring

Key metrics to watch for connection-pool health:

| Metric | Alert threshold | Action |
|--------|----------------|--------|
| `pg_stat_activity.count` | > 80 % of `max_connections` | Add PgBouncer or scale down pods |
| Pool wait time (P95) | > 100 ms | Increase pool size |
| Replication lag | > 1 s | Investigate replica load or network |
| Transaction duration (P99) | > 5 s | Query optimisation or index review |

See [docs/MONITORING_SETUP.md](./MONITORING_SETUP.md) for the full Prometheus
/ Grafana dashboard setup.
