# Mainnet Launch Checklist & Runbook

This document defines the definitive procedure for deploying BlueCollar to Stellar mainnet. Every step is designed to be auditable, repeatable, and reversible.

---

## Table of Contents

- [Pre-Launch: T-7 Days](#pre-launch-t-7-days)
- [Pre-Launch: T-1 Day](#pre-launch-t-1-day)
- [Launch Day: Contract Deployment](#launch-day-contract-deployment)
- [Launch Day: Infrastructure Deployment](#launch-day-infrastructure-deployment)
- [Launch Day: Smoke Tests](#launch-day-smoke-tests)
- [Post-Launch: Monitoring](#post-launch-monitoring)
- [Rollback Procedures](#rollback-procedures)
- [Key Custody](#key-custody)
- [Emergency Contacts](#emergency-contacts)

---

## Pre-Launch: T-7 Days

### Governance & Sign-Off

- [ ] Mainnet launch approved by core maintainers
- [ ] Insurance Pool funded with sufficient XLM for initial claims coverage
- [ ] Fee distribution recipients configured and verified
- [ ] Legal review completed (terms, privacy policy, disclaimers)
- [ ] Security audit report reviewed and all critical/high findings resolved
- [ ] Bug bounty program active

### Contract Readiness

- [ ] All contract code tagged in git (`mainnet-v1.0.0`)
- [ ] Final audit of Registry contract complete
- [ ] Final audit of Market contract complete
- [ ] Final audit of Dispute contract complete
- [ ] Final audit of FeeDistribution contract complete
- [ ] Final audit of InsurancePool contract complete
- [ ] Gas benchmarking complete (see `deploy/load-tests/contract-gas-test.js`)
- [ ] Storage TTL strategy confirmed (see `docs/CONTRACTS.md` for TTL constants)
- [ ] Contract upgrade path tested and documented

### Stellar Accounts

- [ ] Admin key pair generated (see [Key Custody](#key-custody))
- [ ] Admin account funded with sufficient XLM for deployment fees
- [ ] Protocol fee wallet created and funded
- [ ] Insurance Pool reserve wallet created and funded
- [ ] Dispute arbitrator addresses configured
- [ ] Account minimum balances verified (2 XLM base reserve + subentry reserves)

### Testnet Final Dress Rehearsal

- [ ] Full deploy pipeline run against testnet
- [ ] End-to-end flow: register worker → tip → dispute → resolve
- [ ] Contract upgrade tested on testnet
- [ ] Smoke tests pass on testnet
- [ ] Load tests pass on testnet (see `deploy/load-tests/`)
- [ ] Rollback procedure verified on testnet

### Infrastructure

- [ ] Production Kubernetes cluster provisioned
- [ ] Production PostgreSQL instance provisioned (16+, HA config)
- [ ] PgBouncer configured for production (see `docs/PRODUCTION_DEPLOYMENT.md#pgbouncer`)
- [ ] Terraform state locked and reviewed (`terraform plan` green for production)
- [ ] DNS records created:
  - `api.bluecollar.com` → production load balancer
  - `app.bluecollar.com` → production load balancer
  - `status.bluecollar.com` → status page
- [ ] TLS certificates issued and auto-renew configured (Certbot / Let's Encrypt)
- [ ] CDN configured (if applicable, see `deploy/terraform/cdn.tf`)
- [ ] ArgoCD application manifests created (see `deploy/argocd/`)
- [ ] Vault/secret manager configured and accessible to deployer(s)

### Monitoring & Alerting

- [ ] Prometheus + Grafana deployed to production cluster
- [ ] Loki + Promtail deployed for centralized logging (see `deploy/otel/`)
- [ ] Alertmanager configured with PagerDuty/Email/Slack integration
- [ ] Grafana dashboards imported:
  - System Overview (`deploy/grafana/dashboards/system-overview.json`)
  - API Performance (`deploy/grafana/dashboards/api-performance.json`)
  - Business Metrics (`deploy/grafana/dashboards/business-metrics.json`)
  - Performance Dashboard (`deploy/grafana/dashboards/performance-dashboard.json`)
- [ ] Uptime monitoring configured (UptimeRobot / Better Stack) — checks `/health` and `/` every 60s
- [ ] Log alerting configured: >10 ERROR/min for 1min fires alert
- [ ] Backup monitoring configured (backup success/failure alerts)
- [ ] TLS cert expiry alerts configured (< 15 days)
- [ ] Database storage alerts configured (> 80%)

### Security

- [ ] Production secrets rotated from any testnet/staging values:
  - `JWT_SECRET`
  - `DATABASE_URL` (new production credentials)
  - Google OAuth client ID/secret (production credentials)
  - SMTP credentials
  - VAPID keypair
- [ ] CORS origins locked to production domains
- [ ] Rate limiting configured (see `docs/RATE_LIMITING.md`)
- [ ] HSTS header enabled after HTTPS stability verified
- [ ] Database network access restricted to API hosts and admin IPs
- [ ] CI/CD pipelines secured (no secrets in logs, branch protection on `main`)

### Documentation

- [ ] `packages/api/.env.production` template complete
- [ ] `packages/app/.env.production` template complete
- [ ] Production contract IDs documented (to be filled after deployment)
- [ ] Support contact information published
- [ ] Status page URL published

---

## Pre-Launch: T-1 Day

### Final Checks

- [ ] All pre-launch checklist items signed off
- [ ] Incident runbook printed/accessible offline (`docs/INCIDENT_RUNBOOK.md`)
- [ ] Rollback scripts verified executable (`deploy/scripts/rollback.sh`)
- [ ] Database backup verified restorable
- [ ] Smoke test scripts verified (`deploy/scripts/smoke-tests.sh`)
- [ ] All team members have access to:
  - Production cluster (kubectl context)
  - Grafana dashboards
  - Alertmanager
  - Secret manager / Vault
  - Cloud provider console (read-only for most)
- [ ] Communication channel established (dedicated Slack/Discord channel, Telegram group)
- [ ] Go/no-go decision call scheduled

---

## Launch Day: Contract Deployment

### Prerequisites

```bash
# Set mainnet environment
export STELLAR_NETWORK=mainnet
export STELLAR_RPC=https://soroban-rpc.stellar.org
export STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
export ADMIN_SECRET_KEY=<from-vault>
```

### Step 1 — Build WASM Artifacts

```bash
cd packages/contracts
make build
# Verify WASM hashes match the audited commit
sha256sum target/wasm32v1-none/release/*.wasm
```

### Step 2 — Deploy Contracts (in order)

Contracts must be deployed in dependency order. Each outputs a contract ID — save these immediately.

```bash
# 1. Registry (no dependencies)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet
# SAVE output as REGISTRY_CONTRACT_ID

# 2. FeeDistribution (no dependencies)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_fee_distribution.wasm \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet
# SAVE output as FEE_DISTRIBUTION_CONTRACT_ID

# 3. Dispute (no dependencies)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_dispute.wasm \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet
# SAVE output as DISPUTE_CONTRACT_ID

# 4. InsurancePool (no dependencies)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_insurance_pool.wasm \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet
# SAVE output as INSURANCE_POOL_CONTRACT_ID

# 5. Market (depends on previously deployed contracts if referenced)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_market.wasm \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet
# SAVE output as MARKET_CONTRACT_ID
```

### Step 3 — Initialize Contracts

```bash
# Initialize Registry with admin address
stellar contract invoke \
  --id "$REGISTRY_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- init \
  --admin <admin-address>

# Initialize FeeDistribution with recipient addresses
stellar contract invoke \
  --id "$FEE_DISTRIBUTION_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- init \
  --admin <admin-address> \
  --recipients <comma-separated-recipient-addresses>

# Initialize Dispute contract with arbitrator addresses
stellar contract invoke \
  --id "$DISPUTE_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- init \
  --admin <admin-address> \
  --arbitrators <comma-separated-arbitrator-addresses>

# Initialize InsurancePool
stellar contract invoke \
  --id "$INSURANCE_POOL_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- init \
  --admin <admin-address>

# Initialize Market
stellar contract invoke \
  --id "$MARKET_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- init \
  --admin <admin-address>
```

### Step 4 — Verify On-Chain State

```bash
# Verify each contract is initialized
stellar contract invoke \
  --id "$REGISTRY_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- admin

# Should return the admin address
```

### Step 5 — Record Contract IDs

Save all contract IDs to your secret manager and update environment configs:

```env
# Production environment
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<registry-contract-id>
NEXT_PUBLIC_MARKET_CONTRACT_ID=<market-contract-id>
NEXT_PUBLIC_DISPUTE_CONTRACT_ID=<dispute-contract-id>
NEXT_PUBLIC_FEE_DISTRIBUTION_CONTRACT_ID=<fee-distribution-contract-id>
NEXT_PUBLIC_INSURANCE_POOL_CONTRACT_ID=<insurance-pool-contract-id>
```

Write contract IDs to an encrypted file for offline backup:

```bash
gpg --symmetric --cipher-algo AES256 bluecollar-mainnet-contract-ids.txt
# Store this in a safe location (not in the repository)
```

---

## Launch Day: Infrastructure Deployment

### Step 1 — Deploy Infrastructure

```bash
# Apply Terraform (review plan first!)
cd deploy/terraform
terraform workspace select production
terraform plan -var-file=environments/production.tfvars -out=plan.tfplan
# Have a second person review the plan
terraform apply plan.tfplan
```

### Step 2 — Deploy Application

Using ArgoCD (production requires manual sync):

```bash
# Verify ArgoCD applications exist
argocd app list

# Sync API - manual approval step
argocd app sync bluecollar-api --namespace production

# Sync App - manual approval step
argocd app sync bluecollar-app --namespace production
```

Or using the deploy script:

```bash
./deploy/scripts/deploy-with-rollback.sh production v1.0.0
```

### Step 3 — Run Database Migrations

```bash
kubectl exec -it deployment/bluecollar-api -n production -- \
  npx prisma migrate deploy
```

### Step 4 — Verify Deployment

```bash
# Check deployment health
kubectl rollout status deployment/bluecollar-api -n production
kubectl rollout status deployment/bluecollar-app -n production

# Check pods are running
kubectl get pods -n production
```

---

## Launch Day: Smoke Tests

Run the smoke test suite to validate the deployment:

```bash
# Run smoke tests
./deploy/scripts/smoke-tests.sh \
  --api-url https://api.bluecollar.com \
  --app-url https://app.bluecollar.com
```

### Manual Smoke Test Checklist

| Test Case | Command | Expected |
|---|---|---|
| Health check | `curl -f https://api.bluecollar.com/health` | `{"status":"ok"}` |
| Categories list | `curl https://api.bluecollar.com/api/categories` | 200, array of categories |
| App loads | `curl -f https://app.bluecollar.com/en/workers` | 200, HTML content |
| Wallet connect | Open app, connect Freighter wallet | Wallet address displayed |
| Contract read | Invoke `get_worker` via app or CLI | Returns contract data or appropriate error |
| Login flow | `POST /auth/login` with test credentials | 202, token returned |
| Register user | `POST /auth/register` | 201, user created |

### Verify Contract Integration

```bash
# Read from Registry contract
stellar contract invoke \
  --id "$REGISTRY_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- list_workers

# Should return empty list (or existing test data)
```

---

## Post-Launch: Monitoring

### First 24 Hours (Hyper-Care)

- [ ] Monitor API error rate in Grafana — must stay below 1%
- [ ] Monitor API latency (p95 < 500ms)
- [ ] Monitor database connections and query performance
- [ ] Monitor contract transaction success rate
- [ ] Monitor wallet connection success rate
- [ ] Check logs for unexpected errors every 2 hours
- [ ] Verify backup ran successfully (daily)
- [ ] Check TLS certificate validity
- [ ] Verify alerting is firing correctly (test with a known issue)

### First Week (Steady-State)

- [ ] Review and tune alert thresholds based on observed baseline
- [ ] Verify fee distribution transactions are processing
- [ ] Monitor XLM balance of admin account (refill if low)
- [ ] Monitor storage TTL extension calls (bots/users extending entries)
- [ ] Review first week's incident log (if any)
- [ ] Publish post-launch retrospective

### Ongoing

| Task | Frequency | Owner |
|---|---|---|
| Backup verification | Daily | Ops |
| Log review | Daily | On-call |
| Grafana dashboard review | Weekly | Team |
| Dependency updates | Weekly | Dev |
| Secret rotation (JWT, OAuth, SMTP) | Quarterly | Ops |
| Contract upgrade review | Per release | Dev |

---

## Rollback Procedures

### Rollback Contract Deployment

If a contract has a critical bug, use the `upgrade` function to deploy a fixed WASM:

```bash
# 1. Build fixed WASM
cd packages/contracts
make build

# 2. Install new WASM to get its hash
stellar contract install \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet

# 3. Upgrade contract
stellar contract invoke \
  --id "$REGISTRY_CONTRACT_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network mainnet \
  -- upgrade \
  --admin <admin-address> \
  --new_wasm_hash <new-wasm-hash>
```

> **Note:** Contract upgrades preserve storage. You cannot revert to a previous WASM version after upgrade; you must deploy the old code as a "new" upgrade.

### Rollback Application Deployment

```bash
# Using kubectl (quick rollback)
kubectl rollout undo deployment/bluecollar-api -n production
kubectl rollout undo deployment/bluecollar-app -n production

# Using ArgoCD
argocd app rollback bluecollar-api --namespace production

# Using the deploy script
./deploy/scripts/rollback.sh production
```

### Rollback Database Migration

If a Prisma migration introduced a breaking change:

1. **Do NOT run `prisma migrate deploy` on the new migration** if you suspect it may fail.
2. Rollback the application first (above).
3. To revert an already-applied migration:
   ```bash
   # Connect directly to the database (not through PgBouncer)
   DATABASE_URL=postgresql://... npx prisma migrate resolve --rolled-back <migration-name>
   ```
4. Manually revert schema changes if necessary (requires DBA access).
5. Verify the previous application version works with the reverted schema.

> Destructive migrations (DROP COLUMN, DROP TABLE, ALTER COLUMN) must always be reversible. Prefer additive migrations and schedule cleanup migrations separately.

### Database Restore (Full Disaster)

If data corruption or loss occurs:

```bash
# 1. Stop the API (prevent further writes)
kubectl scale deployment bluecollar-api -n production --replicas=0

# 2. Restore from latest verified backup
./deploy/scripts/restore-database.sh production

# 3. Verify restored data
./deploy/scripts/verify-backup.sh production

# 4. Restart API
kubectl scale deployment bluecollar-api -n production --replicas=3

# 5. Run smoke tests
./deploy/scripts/smoke-tests.sh --api-url https://api.bluecollar.com

# 6. File incident report (see docs/INCIDENT_RUNBOOK.md)
```

---

## Key Custody

### Key Inventory

| Key | Purpose | Custodian(s) | Backup Location |
|---|---|---|---|
| Contract Admin Secret | Deploy & upgrade contracts | 2-of-3 multi-sig | Hardware wallet + encrypted USB |
| API JWT Secret | Sign user session tokens | Ops lead | Vault + encrypted backup |
| Database Password | API → PostgreSQL | Ops lead | Vault |
| Google OAuth Secret | OAuth 2.0 login | Ops lead | Vault |
| SMTP Password | Email sending | Ops lead | Vault |
| VAPID Private Key | Web push notifications | Ops lead | Vault |
| TLS Private Key | HTTPS termination | Ops lead | Vault |

### Key Management Principles

1. **No keys in source control** — all secrets injected at runtime via Vault / cloud secret manager
2. **Principle of least privilege** — each deployment environment uses separate credentials
3. **Rotation schedule** — JWT, OAuth, SMTP, VAPID rotated quarterly; DB password rotated after any team change
4. **Audit trail** — all key access logged (Vault audit log)
5. **Recovery** — contract admin key has a documented recovery process (hardware wallet backup + social recovery)

### Contract Admin Key Ceremony

The contract admin key is the most sensitive credential. Use a 2-of-3 multi-sig:

1. Generate key on an air-gapped machine
2. Split into 3 shards using Shamir's Secret Sharing
3. Distribute shards to 3 trusted team members
4. Store the full key on a hardware wallet in a safety deposit box
5. Document the recovery procedure in the team's emergency plan

---

## Emergency Contacts

| Role | Name | Contact |
|---|---|---|
| Lead Maintainer | | |
| DevOps / Infra | | |
| Smart Contracts | | |
| Frontend | | |
| Database Admin | | |

*Fill in contacts before launch. Update the incident runbook (`docs/INCIDENT_RUNBOOK.md`) with the same list.*

---

## Version History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | TBD | BlueCollar Team | Initial mainnet launch checklist |

---

## References

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Incident Runbook](./INCIDENT_RUNBOOK.md)
- [Contract Reference](./CONTRACTS.md)
- [Contract Integration Guide](./CONTRACT_INTEGRATION.md)
- [Stellar Wallet Integration Guide](./stellar-wallet-integration.md)
- [Monitoring & Alerting Guide](./MONITORING_AND_ALERTING.md)
- [Secret Management](./SECRETS_MANAGEMENT.md)
- [Deploy Scripts](../deploy/scripts/)
- [Terraform Config](../deploy/terraform/)
