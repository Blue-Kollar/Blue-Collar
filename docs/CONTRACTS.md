# Smart Contract Reference

> **Audience**: Integrators, dApp developers, and contributors.
> **Covers**: Registry, Market, Dispute, FeeDistribution, and InsurancePool contracts.
> **Network**: Stellar Soroban (testnet / mainnet).

## Table of Contents

- [Common Patterns](#common-patterns)
  - [Storage TTL Strategy](#storage-ttl-strategy)
  - [Authorization Model](#authorization-model)
  - [Upgrade Flow](#upgrade-flow)
- [Registry Contract](#registry-contract)
- [Market Contract](#market-contract)
- [Dispute Contract](#dispute-contract)
- [FeeDistribution Contract](#feedistribution-contract)
- [InsurancePool Contract](#insurancepool-contract)
- [Event Catalogue](#event-catalogue)

---

## Common Patterns

### Storage TTL Strategy

All contracts use Soroban persistent storage with a consistent TTL (time-to-live) extension strategy to prevent ledger entries from expiring.

| Constant | Value | Approximate Duration |
|---|---|---|
| `TTL_EXTEND_TO` | 535,000 ledgers | ~1 year (at 5s/ledger) |
| `TTL_THRESHOLD` | 267,500 ledgers | ~6 months |

**Mechanism**:

1. Every write to persistent storage (`register`, `toggle`, `file_dispute`, etc.) automatically calls `extend_ttl` on the affected key.
2. `extend_ttl(key, threshold, extend_to)` only extends if the current TTL is below `threshold`, avoiding unnecessary fees.
3. Public TTL-extension functions (`extend_worker_ttl`) are available so anyone can refresh entries without special permissions.

**Schema versioning** (Registry + Market):

```rust
env.storage().persistent().set(&DataKey::SchemaVersion, &u32_value);
```

Each contract stores a `SchemaVersion` key. The `migrate` function bumps the version and runs upgrade-specific migration logic.

### Authorization Model

| Role | Symbol | Contract | Privileges |
|---|---|---|---|
| `ROLE_ADMIN` | `"admin"` | Registry, Market, FeeDist, Insurance | Full admin; grant/revoke roles |
| `ROLE_PAUSER` | `"pauser"` | Registry, Market, FeeDist, Insurance | Pause/unpause |
| `ROLE_CURATOR_MGR` | `"curator_mgr"` | Registry | Add/remove curators |
| `ROLE_REP_MGR` | `"rep_mgr"` | Registry | Update reputation scores |
| `ROLE_UPGRADER` | `"upgrader"` | Registry, Market, FeeDist, Insurance | Upgrade contract WASM |
| `ROLE_FEE_MANAGER` | `"fee_mgr"` | Market, FeeDistribution | Update fee config |
| `ROLE_DISPUTE_MGR` | `"dispute_mgr"` | Market | Resolve disputes |
| `ROLE_CLAIMS_MGR` | `"claims_mgr"` | InsurancePool | Manage claims |

All roles enforce `caller.require_auth()` via `require_role` helper functions. Unknown roles map to `u64::MAX` storage buckets.

### Upgrade Flow

```
propose_upgrade(admin, new_wasm_hash)   → 48h timelock
        ↓
execute_upgrade()                       → anyone after timelock expires
        ↓
env.deployer().update_current_contract_wasm(new_wasm_hash)
```

**Quick upgrade** (no timelock):

```rust
fn upgrade(env, new_wasm_hash: BytesN<32>) {
    // require ROLE_UPGRADER + auth
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}
```

**Timelock upgrade** (Registry only):

```rust
fn propose_upgrade(env, admin, new_wasm_hash)  // 48h lock
fn execute_upgrade(env)                         // after timelock
fn cancel_upgrade(env, admin)                   // cancel pending
```

**Admin key custody**:

- The admin address is set once at `initialize`.
- Transferable via `set_admin(new_admin)` — current admin must authorize.
- Never share the admin private key. Use a Ledger hardware wallet or Stellar multisig for mainnet.
- See [contract-upgrade-guide.md](./contract-upgrade-guide.md) for full runbook.

---

## Registry Contract

**Source**: `packages/contracts/contracts/registry/src/lib.rs`
**Deployment**: Stellar Soroban, manages on-chain worker registrations.

### Storage Map

| Key | Type | Location | Description |
|---|---|---|---|
| `Admin` | `Address` | Persistent | Bootstrap admin, set once at `initialize` |
| `Paused` | `bool` | Instance | Pause flag; blocks state mutation when `true` |
| `SchemaVersion` | `u32` | Persistent | Current schema version for migrations |
| `RoleMembers(u64)` | `Vec<Address>` | Persistent | Members of a role (keyed by compact role ID) |
| `Curators` | `Vec<Address>` | Persistent | Approved curator addresses |
| `Worker(Symbol)` | `Worker` | Persistent | Worker record keyed by `id` |
| `WorkerList` | `Vec<Symbol>` | Persistent | Ordered list of all registered worker IDs |
| `WorkerCount` | `u32` | Persistent | Total count for efficient pagination |
| `CategoryVerification(Symbol, Symbol)` | `CategoryVerification` | Persistent | Verification record per (worker_id, category) |
| `StakeInfo(Symbol)` | `StakeInfo` | Persistent | Staking info per worker |
| `PerformanceMetrics(Symbol)` | `PerformanceMetrics` | Persistent | Performance metrics per worker |
| `Delegates(Symbol)` | `Vec<Delegate>` | Persistent | Delegate addresses for a worker |
| `WorkerBadges(Symbol)` | `Vec<Symbol>` | Persistent | Badge IDs for a worker |
| `Badge(Symbol, Symbol)` | `Badge` | Persistent | Individual badge keyed by (worker_id, badge_id) |
| `Subscription(Symbol)` | `WorkerSubscription` | Persistent | Subscription tier per worker |
| `LocationVerification(Symbol)` | `LocationVerification` | Persistent | Location verification per worker |
| `AvailabilityStatus(Symbol)` | `AvailabilityStatus` | Persistent | Availability status per worker |
| `Categories` | `Vec<Symbol>` | Persistent | Valid on-chain category symbols |
| `PendingUpgrade` | `PendingUpgrade` | Persistent | Timelocked upgrade record |
| `ReputationHistory(Symbol)` | `Vec<ReputationEvent>` | Persistent | Immutable reputation history (#677) |
| `ReputationInputs(Symbol)` | `ReputationInputs` | Persistent | Aggregated inputs for reputation calculation (#677) |

### Key Types

**`Worker`** (the core on-chain profile):

| Field | Type | Description |
|---|---|---|
| `id` | `Symbol` | Unique worker identifier (matches off-chain DB id) |
| `owner` | `Address` | Stellar address of the worker's owner account |
| `name` | `String` | Display name |
| `category` | `Symbol` | Trade/skill category (e.g. `plumber`) |
| `is_active` | `bool` | Whether worker is accepting work |
| `wallet` | `Address` | Wallet address for receiving tips/payments |
| `location_hash` | `BytesN<32>` | SHA-256(lowercase(city) + ":" + lowercase(country_iso2)) |
| `contact_hash` | `BytesN<32>` | SHA-256(lowercase(email_or_e164_phone)) |
| `reputation` | `u32` | Reputation score in basis points (0-10000) |
| `verified_categories` | `Vec<Symbol>` | Categories verified on-chain by curators |
| `staked_amount` | `i128` | Total tokens staked for visibility boost |
| `review_count` | `u32` | Total number of reviews |
| `avg_rating` | `u32` | Average rating in basis points (0-10000) |
| `subscription` | `WorkerSubscription` | Subscription tier, expiry, last renewal |

### Public Functions

| Function | Auth | Parameters | Returns | Description |
|---|---|---|---|---|
| `initialize(admin)` | — | `admin: Address` | — | Init contract, grants `ROLE_ADMIN` to `admin`. Panics if already initialized. |
| `register(id, owner, name, category, location_hash, contact_hash, curator)` | `curator.require_auth()` | `id: Symbol, owner: Address, name: String, category: Symbol, location_hash: BytesN<32>, contact_hash: BytesN<32>, curator: Address` | — | Register a new worker. Curator-gated. Emits `WorkerRegistered`. |
| `toggle(id, caller)` | `caller.require_auth()` | `id: Symbol, caller: Address` | — | Flip worker `is_active`. Owner or delegate only. |
| `update(id, caller, name, category, location_hash, contact_hash)` | `caller.require_auth()` | `id: Symbol, caller: Address, name: String, category: Symbol, location_hash: BytesN<32>, contact_hash: BytesN<32>` | — | Update name, category, hashes. Owner or delegate. |
| `update_worker(id, caller, name, category, wallet)` | `caller.require_auth()` | `id: Symbol, caller: Address, name: String, category: Symbol, wallet: Address` | — | Update name, category, and wallet address. Owner or delegate. |
| `deregister(id, caller)` | `caller.require_auth()` | `id: Symbol, caller: Address` | — | Permanently remove worker. Owner only. |
| `get_worker(id)` | — | `id: Symbol` | `Option<Worker>` | Read worker by ID. |
| `list_workers()` | — | — | `Vec<Symbol>` | Deprecated. Returns all worker IDs. |
| `list_workers_paginated(offset, limit)` | — | `offset: u32, limit: u32` | `Vec<Symbol>` | Paginated worker IDs. |
| `list_workers_page(offset, limit)` | — | `offset: u32, limit: u32` | `WorkerPage { ids, total }` | Paginated result with total count. |
| `worker_count()` | — | — | `u32` | Total registered workers. |
| `extend_worker_ttl(id)` | — | `id: Symbol` | — | Extend TTL for a worker entry. Anyone may call. |
| `is_initialized()` | — | — | `bool` | Whether contract has been initialized. |
| `get_admin()` | — | — | `Address` | Get admin address. |
| `set_admin(new_admin)` | `current_admin.require_auth()` | `new_admin: Address` | — | Transfer admin. |
| `add_curator(admin, curator)` | `ROLE_CURATOR_MGR` | `admin: Address, curator: Address` | — | Add curator. Idempotent. |
| `remove_curator(admin, curator)` | `ROLE_CURATOR_MGR` | `admin: Address, curator: Address` | — | Remove curator. |
| `is_curator(addr)` | — | `addr: Address` | `bool` | Check if address is curator. |
| `grant_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Grant role. Idempotent. |
| `revoke_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Revoke role. |
| `has_role(role, account)` | — | `role: Symbol, account: Address` | `bool` | Check role membership. |
| `get_role_members_list(role)` | — | `role: Symbol` | `Vec<Address>` | List role members. |
| `pause(admin)` | `ROLE_PAUSER` | `admin: Address` | — | Pause contract. |
| `unpause(admin)` | `ROLE_PAUSER` | `admin: Address` | — | Unpause contract. |
| `is_paused()` | — | — | `bool` | Check paused state. |
| `add_delegate(id, owner, delegate, expires_at)` | `owner.require_auth()` | `id: Symbol, owner: Address, delegate: Address, expires_at: u64` | — | Add profile delegate. |
| `remove_delegate(id, owner, delegate)` | `owner.require_auth()` | `id: Symbol, owner: Address, delegate: Address` | — | Remove delegate. |
| `get_worker_delegates(id)` | — | `id: Symbol` | `Vec<Delegate>` | Get delegates for worker. |
| `update_reputation(admin, id, score)` | `ROLE_REP_MGR` | `admin: Address, id: Symbol, score: u32` | — | Update reputation (0-10000). |
| `submit_review(reviewer, worker_id, rating)` | `reviewer.require_auth()` | `reviewer: Address, worker_id: Symbol, rating: u32` | — | Submit rating (0-10000). Auto-slash if avg < 3000. |
| `record_job_completion(caller, worker_id)` | `ROLE_REP_MGR` | `caller: Address, worker_id: Symbol` | — | Increment tip count, recalculate reputation. |
| `slash_reputation(caller, worker_id, slash_bps)` | `ROLE_REP_MGR` | `caller: Address, worker_id: Symbol, slash_bps: u32` | — | Subtract basis points from reputation. |
| `get_reputation_history(worker_id)` | — | `worker_id: Symbol` | `Vec<ReputationEvent>` | Get immutable history (max 100 entries). |
| `get_reputation_inputs(worker_id)` | — | `worker_id: Symbol` | `Option<ReputationInputs>` | Get raw reputation inputs. |
| `update_reviews(admin, id, review_count, avg_rating)` | `ROLE_ADMIN` | `admin: Address, id: Symbol, review_count: u32, avg_rating: u32` | — | Update review aggregate (admin). |
| `update_subscription(admin, id, tier, expires_at)` | `ROLE_ADMIN` | `admin: Address, id: Symbol, tier: u32, expires_at: u64` | — | Set subscription tier (0=Free, 1=Basic, 2=Premium). |
| `renew_subscription(caller, id, new_expires_at)` | `caller.require_auth()` | `caller: Address, id: Symbol, new_expires_at: u64` | — | Renew subscription (owner/delegate). |
| `get_subscription(id)` | — | `id: Symbol` | `WorkerSubscription` | Get subscription status. |
| `verify_category(curator, worker_id, category, expires_at)` | `curator.require_auth()` | `curator: Address, worker_id: Symbol, category: Symbol, expires_at: u64` | — | Verify worker category. Curator-gated. |
| `get_category_verification(worker_id, category)` | — | `worker_id: Symbol, category: Symbol` | `Option<CategoryVerification>` | Get verification record. |
| `verify_location(verifier, worker_id, expires_at)` | `verifier.require_auth()` | `verifier: Address, worker_id: Symbol, expires_at: u64` | — | Verify worker location. |
| `get_location_verification(worker_id)` | — | `worker_id: Symbol` | `Option<LocationVerification>` | Get location verification. |
| `update_availability(id, caller, is_available, expires_at)` | `caller.require_auth()` | `id: Symbol, caller: Address, is_available: bool, expires_at: u64` | — | Set availability (owner only). |
| `get_availability(worker_id)` | — | `worker_id: Symbol` | `Option<AvailabilityStatus>` | Get availability. |
| `batch_register(curator, ids, owners, names, categories, location_hashes, contact_hashes)` | `curator.require_auth()` | (parallel vecs) | `Vec<BatchRegisterResult>` | Register up to 20 workers. Partial success. |
| `batch_toggle(caller, ids)` | `caller.require_auth()`, must be curator | `caller: Address, ids: Vec<Symbol>` (max `MAX_BATCH_SIZE`) | `Vec<(Symbol, bool)>` | Toggle `is_active` for multiple workers. Skips ids that don't exist (partial success). |
| `stake(caller, worker_id, token_addr, amount)` | `caller.require_auth()` | `caller: Address, worker_id: Symbol, token_addr: Address, amount: i128` | — | Stake tokens for visibility (owner only). |
| `request_unstake(caller, worker_id)` | `caller.require_auth()` | `caller: Address, worker_id: Symbol` | — | Start 7-day unstake cooldown. |
| `unstake(caller, worker_id)` | `caller.require_auth()` | `caller: Address, worker_id: Symbol` | — | Finalise unstake after cooldown. Returns tokens + rewards. |
| `get_stake_info(worker_id)` | — | `worker_id: Symbol` | `Option<StakeInfo>` | Get staking info. |
| `update_metrics(admin, worker_id, jobs_completed, rating)` | `ROLE_REP_MGR` | `admin: Address, worker_id: Symbol, jobs_completed: u32, rating: u32` | — | Update performance metrics. |
| `get_metrics(worker_id)` | — | `worker_id: Symbol` | `Option<PerformanceMetrics>` | Get performance metrics. |
| `award_badge(issuer, worker_id, badge_id, name, expires_at)` | `issuer.require_auth()` | `issuer: Address, worker_id: Symbol, badge_id: Symbol, name: String, expires_at: u64` | — | Award badge (admin or curator). |
| `revoke_badge(caller, worker_id, badge_id)` | `caller.require_auth()` | `caller: Address, worker_id: Symbol, badge_id: Symbol` | — | Revoke badge (admin or original issuer). |
| `verify_badge(worker_id, badge_id)` | — | `worker_id: Symbol, badge_id: Symbol` | `bool` | Check if badge is active. |
| `get_worker_badges(worker_id)` | — | `worker_id: Symbol` | `Vec<Badge>` | Get all badges for worker. |
| `get_badge(worker_id, badge_id)` | — | `worker_id: Symbol, badge_id: Symbol` | `Option<Badge>` | Get single badge. |
| `add_category(admin, name)` | `ROLE_ADMIN` | `admin: Address, name: Symbol` | — | Add valid category (idempotent). |
| `remove_category(admin, name)` | `ROLE_ADMIN` | `admin: Address, name: Symbol` | — | Remove valid category. |
| `list_categories()` | — | — | `Vec<Symbol>` | List all valid categories. |
| `propose_upgrade(admin, new_wasm_hash)` | `ROLE_UPGRADER` | `admin: Address, new_wasm_hash: BytesN<32>` | — | Propose upgrade with 48h timelock. |
| `execute_upgrade()` | — | — | — | Execute pending upgrade after timelock. |
| `cancel_upgrade(admin)` | `ROLE_UPGRADER` | `admin: Address` | — | Cancel pending upgrade. |
| `get_pending_upgrade()` | — | — | `Option<PendingUpgrade>` | Get pending upgrade record. |
| `upgrade(new_wasm_hash)` | `ROLE_UPGRADER` | `new_wasm_hash: BytesN<32>` | — | Immediate upgrade (no timelock). |
| `migrate(admin, expected_version)` | `ROLE_ADMIN` | `admin: Address, expected_version: u32` | — | Run version-specific storage migration. |
| `get_schema_version()` | — | — | `u32` | Get current schema version. |

### Certification & Verification Functions

Two related but distinct sub-APIs, both curator/admin-gated writes with public reads.
Certifications (`registry/src/certifications.rs`) are individually revocable records
with their own lifecycle; certified skills are simpler tag-like entries keyed by skill
symbol, and verification level is a single per-worker status flag. See
[CERTIFICATION_TRACKING.md](../packages/contracts/CERTIFICATION_TRACKING.md) for the
full `Certification` struct, storage keys, and event details for the first group.

| Function | Auth | Parameters | Returns | Description |
|---|---|---|---|---|
| `add_certification(caller, worker_id, cert_id, issuer, name, issued_at, expires_at)` | curator/admin | `caller: Address, worker_id: Symbol, cert_id: Symbol, issuer: String, name: String, issued_at: u64, expires_at: u64` | — | Add a certification record. See CERTIFICATION_TRACKING.md. |
| `remove_certification(caller, worker_id, cert_id)` | curator/admin | `caller: Address, worker_id: Symbol, cert_id: Symbol` | — | Remove a certification record. |
| `verify_certification(caller, cert_id)` | curator/admin | `caller: Address, cert_id: Symbol` | — | Mark a certification as verified. |
| `get_certification(cert_id)` | — | `cert_id: Symbol` | `Option<Certification>` | Get a single certification. |
| `get_certification_count(worker_id)` | — | `worker_id: Symbol` | `u32` | Count of certifications for a worker. |
| `get_worker_certifications(worker_id)` | — | `worker_id: Symbol` | `Vec<Certification>` | All certifications for a worker. |
| `get_valid_certifications(worker_id)` | — | `worker_id: Symbol` | `Vec<Certification>` | Non-expired certifications for a worker. |
| `get_verified_certification_count(worker_id)` | — | `worker_id: Symbol` | `u32` | Count of verified certifications for a worker. |
| `is_certification_valid(cert_id)` | — | `cert_id: Symbol` | `bool` | Whether a certification exists and hasn't expired. |
| `set_verification_level(caller, worker_id, level)` | `ROLE_CURATOR_MGR` or `ROLE_ADMIN` | `caller: Address, worker_id: Symbol, level: VerificationLevel` | — | Set a worker's verification level. Panics `"Worker not found"` if unknown. |
| `get_verification_level(worker_id)` | — | `worker_id: Symbol` | `VerificationLevel` | Get a worker's verification level; `VerificationLevel::None` if unset. |
| `add_certified_skill(caller, worker_id, skill, expires_at)` | `ROLE_CURATOR_MGR` or `ROLE_ADMIN` | `caller: Address, worker_id: Symbol, skill: Symbol, expires_at: u64` | — | Add/replace a certified skill entry (`expires_at: 0` = no expiry). |
| `revoke_certified_skill(caller, worker_id, skill)` | `ROLE_CURATOR_MGR` or `ROLE_ADMIN` | `caller: Address, worker_id: Symbol, skill: Symbol` | — | Remove a certified skill. Panics `"Skill not found"` if absent. |
| `get_certified_skills(worker_id)` | — | `worker_id: Symbol` | `Vec<CertifiedSkill>` | All certified skills for a worker. |

---

## Market Contract

**Source**: `packages/contracts/contracts/market/src/lib.rs`
**Deployment**: Stellar Soroban, handles tips, escrow payments, multi-sig escrows, and arbitration.

### Storage Map

| Key | Type | Location | Description |
|---|---|---|---|
| `Config` | `Config { fee_bps, fee_recipient }` | Instance | Protocol config, set at `initialize` |
| `Admin` | `Address` | Persistent | Admin address |
| `Paused` | `bool` | Instance | Pause flag |
| `SchemaVersion` | `u32` | Persistent | Current schema version |
| `RoleMembers(u64)` | `Vec<Address>` | Persistent | Role member lists |
| `Escrow(Symbol)` | `Escrow` | Persistent | Escrow record keyed by ID |
| `MultiSigEscrow(Symbol)` | `MultiSigEscrow` | Persistent | Multi-sig escrow record keyed by ID |
| `Arbitration(Symbol)` | `Arbitration` | Persistent | Arbitration record keyed by escrow ID |
| `Arbitrators` | `Vec<Address>` | Persistent | Approved arbitrator addresses |

### Key Types

**`Config`**:

| Field | Type | Description |
|---|---|---|
| `fee_bps` | `u32` | Protocol fee in basis points (max 500 = 5%) |
| `fee_recipient` | `Address` | Address receiving collected fees |

**`Escrow`**:

| Field | Type | Description |
|---|---|---|
| `from` | `Address` | Payer address |
| `to` | `Address` | Worker/recipient address |
| `token` | `Address` | Token contract address |
| `amount` | `i128` | Locked amount |
| `expiry` | `u64` | Unix timestamp after which payer may cancel |
| `released` | `bool` | Funds released to `to` |
| `cancelled` | `bool` | Funds refunded to `from` |
| `arbitration_requested` | `bool` | Arbitration has been requested |

**`MultiSigEscrow`**:

| Field | Type | Description |
|---|---|---|
| `from` | `Address` | Payer address |
| `to` | `Address` | Worker address |
| `token` | `Address` | Token contract address |
| `amount` | `i128` | Locked amount |
| `expiry` | `u64` | Cancellation expiry |
| `signers` | `Vec<Address>` | Authorised approvers |
| `threshold` | `u32` | Required approval count |
| `approvals` | `Vec<Address>` | Addresses that have approved |
| `released` | `bool` | Funds released |
| `cancelled` | `bool` | Funds refunded |

### Public Functions

| Function | Auth | Parameters | Returns | Description |
|---|---|---|---|---|
| `initialize(admin, fee_bps, fee_recipient)` | — | `admin: Address, fee_bps: u32, fee_recipient: Address` | — | Init contract with fee config. `fee_bps <= 500`. |
| `tip(from, to, token_addr, amount)` | `from.require_auth()` | `from: Address, to: Address, token_addr: Address, amount: i128` | — | Transfer `amount` minus `fee_bps` to `to`. Fee to `fee_recipient`. |
| `create_escrow(id, from, to, token_addr, amount, expiry)` | `from.require_auth()` | `id: Symbol, from: Address, to: Address, token_addr: Address, amount: i128, expiry: u64` | — | Lock tokens in escrow. |
| `release_escrow(id, caller)` | `caller.require_auth()` | `id: Symbol, caller: Address` | — | Release funds to `to`. Callable by `from` or `to`. |
| `batch_release_escrow(caller, ids)` | `caller.require_auth()` | `caller: Address, ids: Vec<Symbol>` (max 20) | `Vec<Symbol>` | Release multiple escrows in one call. Skips already-released/cancelled or unauthorised ids (partial success); returns the ids that succeeded. |
| `cancel_escrow(id, caller)` | `caller.require_auth()` | `id: Symbol, caller: Address` | — | Refund `from` after `expiry`. Payer only. |
| `cancel_expired_escrow(id)` | — | `id: Symbol` | — | Anyone can cancel an expired escrow. |
| `get_escrow(id)` | — | `id: Symbol` | `Option<Escrow>` | Get escrow details. |
| `get_config()` | — | — | `Config` | Get fee configuration. |
| `create_multisig_escrow(id, from, to, token_addr, amount, expiry, signers, threshold)` | `from.require_auth()` | `id: Symbol, from: Address, to: Address, token_addr: Address, amount: i128, expiry: u64, signers: Vec<Address>, threshold: u32` | — | Create multi-sig escrow. |
| `approve_multisig_release(id, caller)` | `caller.require_auth()` | `id: Symbol, caller: Address` | — | Approve release; auto-releases at threshold. |
| `cancel_multisig_escrow(id, caller)` | `caller.require_auth()` | `id: Symbol, caller: Address` | — | Cancel after expiry (payer only). |
| `get_multisig_escrow(id)` | — | `id: Symbol` | `Option<MultiSigEscrow>` | Get multi-sig escrow. |
| `request_multisig_arbitration(escrow_id, caller, arbitrator, fee)` | `caller.require_auth()` | `escrow_id: Symbol, caller: Address, arbitrator: Address, fee: i128` | — | Request arbitration on multi-sig escrow. |
| `resolve_multisig_arbitration(escrow_id, arbitrator, release_to_worker)` | `arbitrator.require_auth()` | `escrow_id: Symbol, arbitrator: Address, release_to_worker: bool` | — | Arbitrator resolves. |
| `get_multisig_arbitration(escrow_id)` | — | `escrow_id: Symbol` | `Option<Arbitration>` | Get arbitration record. |
| `request_arbitration(escrow_id, caller, arbitrator, fee)` | `caller.require_auth()` | `escrow_id: Symbol, caller: Address, arbitrator: Address, fee: i128` | — | Request arbitration on standard escrow. |
| `resolve_arbitration(escrow_id, arbitrator, release_to_worker)` | `arbitrator.require_auth()` | `escrow_id: Symbol, arbitrator: Address, release_to_worker: bool` | — | Arbitrator resolves standard escrow. |
| `get_arbitration(escrow_id)` | — | `escrow_id: Symbol` | `Option<Arbitration>` | Get arbitration record (standard). |
| `add_arbitrator(arbitrator)` | `admin.require_auth()` | `arbitrator: Address` | — | Add arbitrator (admin only). |
| `remove_arbitrator(arbitrator)` | `admin.require_auth()` | `arbitrator: Address` | — | Remove arbitrator (admin only). |
| `update_fee(new_fee_bps)` | `ROLE_FEE_MANAGER` | `new_fee_bps: u32` | — | Update protocol fee (max 500). |
| `set_treasury(caller, new_treasury)` | `ROLE_ADMIN` | `caller: Address, new_treasury: Address` | — | Update fee recipient. |
| `get_admin()` | — | — | `Address` | Get admin address. |
| `set_admin(new_admin)` | `current_admin.require_auth()` | `new_admin: Address` | — | Transfer admin. |
| `grant_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Grant role. |
| `revoke_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Revoke role. |
| `has_role(role, account)` | — | `role: Symbol, account: Address` | `bool` | Check role. |
| `get_role_members_list(role)` | — | `role: Symbol` | `Vec<Address>` | List role members. |
| `pause(admin)` | `ROLE_PAUSER` | `admin: Address` | — | Pause contract. |
| `unpause(admin)` | `ROLE_PAUSER` | `admin: Address` | — | Unpause contract. |
| `is_paused()` | — | — | `bool` | Check paused state. |
| `upgrade(new_wasm_hash)` | `ROLE_UPGRADER` | `new_wasm_hash: BytesN<32>` | — | Immediate WASM upgrade. |
| `migrate(admin, expected_version)` | `ROLE_ADMIN` | `admin: Address, expected_version: u32` | — | Versioned storage migration. |
| `get_schema_version()` | — | — | `u32` | Get schema version. |

---

## Dispute Contract

**Source**: `packages/contracts/contracts/dispute/src/lib.rs`
**Deployment**: Stellar Soroban. Lifecycle: `file_dispute` (open) → `submit_evidence`
(evidence) → `decide` (arbitrator records outcome, no transfer yet) → `settle` (anyone
executes the transfer per the recorded decision).

### Storage Map

| Key | Type | Location | Description |
|---|---|---|---|
| `Admin` | `Address` | Instance | Admin address |
| `Paused` | `bool` | Instance | Pause flag |
| `Arbitrators` | `Vec<Address>` | Persistent | Approved arbitrator addresses |
| `Dispute(Symbol)` | `Dispute` | Persistent | Dispute record keyed by ID |
| `DisputeList` | `Vec<Symbol>` | Persistent | Ordered list of all dispute IDs |

### Key Types

**`Dispute`**:

| Field | Type | Description |
|---|---|---|
| `id` | `Symbol` | Unique dispute identifier |
| `disputer` | `Address` | Party that filed the dispute and locked the tokens |
| `respondent` | `Address` | Party being disputed against |
| `token` | `Address` | Token contract used for the locked amount |
| `amount` | `i128` | Total amount locked in this contract |
| `status` | `DisputeStatus` | `Open` / `Evidence` / `Decided` / `Settled` |
| `outcome` | `DisputeOutcome` | `RefundDisputer` / `ReleaseRespondent` / `Split`; placeholder `RefundDisputer` until `status >= Decided` |
| `split_bps` | `u32` | Respondent's share in basis points (0–10,000); only meaningful for `Split` |
| `arbitrator` | `Option<Address>` | Arbitrator address once decided |
| `filed_at` | `u64` | Unix timestamp when filed |
| `settled_at` | `u64` | Unix timestamp when settled (`0` until settled) |
| `disputer_evidence` | `Option<String>` | Off-chain evidence hash submitted by the disputer |
| `respondent_evidence` | `Option<String>` | Off-chain evidence hash submitted by the respondent |

### Public Functions

| Function | Auth | Parameters | Returns | Description |
|---|---|---|---|---|
| `initialize(admin)` | — | `admin: Address` | — | Init contract. One-time. |
| `get_admin()` | — | — | `Address` | Get admin. |
| `version()` | — | — | `u32` | Get the event schema version. |
| `pause(admin)` | `admin.require_auth()` | `admin: Address` | — | Pause the contract. |
| `unpause(admin)` | `admin.require_auth()` | `admin: Address` | — | Unpause the contract. |
| `add_arbitrator(admin, arbitrator)` | `admin.require_auth()` | `admin: Address, arbitrator: Address` | — | Add an approved arbitrator (idempotent). |
| `remove_arbitrator(admin, arbitrator)` | `admin.require_auth()` | `admin: Address, arbitrator: Address` | — | Remove an approved arbitrator. |
| `list_arbitrators()` | — | — | `Vec<Address>` | List all approved arbitrators. |
| `file_dispute(id, disputer, respondent, token, amount, evidence_hash)` | `disputer.require_auth()` | `id: Symbol, disputer: Address, respondent: Address, token: Address, amount: i128, evidence_hash: String` | — | File a dispute; locks `amount` tokens in the contract. |
| `submit_evidence(dispute_id, caller, evidence_hash)` | `caller.require_auth()` | `dispute_id: Symbol, caller: Address, evidence_hash: String` | — | Attach an evidence hash. `caller` must be the disputer or respondent; dispute must be `Open` or `Evidence`. |
| `decide(dispute_id, arbitrator, outcome, split_bps)` | `arbitrator.require_auth()` | `dispute_id: Symbol, arbitrator: Address, outcome: DisputeOutcome, split_bps: u32` | — | Record an arbitrator decision (no transfer yet). `arbitrator` must be in the approved list; dispute must be `Open` or `Evidence`. |
| `settle(dispute_id)` | — (callable by anyone) | `dispute_id: Symbol` | — | Execute the token transfer per the recorded decision. Dispute must be `Decided`. |
| `get_dispute(dispute_id)` | — | `dispute_id: Symbol` | `Option<Dispute>` | Get dispute details. |
| `list_disputes()` | — | — | `Vec<Symbol>` | List all dispute IDs. |
| `upgrade(admin, new_wasm_hash)` | `admin.require_auth()` | `admin: Address, new_wasm_hash: BytesN<32>` | — | Upgrade contract WASM. |

---

## FeeDistribution Contract

**Source**: `packages/contracts/contracts/fee_distribution/src/lib.rs`
**Deployment**: Stellar Soroban, manages fee collection and multi-recipient distribution.

### Storage Map

| Key | Type | Location | Description |
|---|---|---|---|
| `Admin` | `Address` | Instance | Admin address |
| `Paused` | `bool` | Instance | Pause flag |
| `RoleMembers(Symbol)` | `Vec<Address>` | Persistent | Role member lists |
| `FeeRecipients` | `Vec<FeeRecipient>` | Persistent | Fee recipient list with percentage splits |
| `FeeCollection(Address)` | `FeeCollection` | Persistent | Collection totals per token |

### Key Types

**`FeeRecipient`**:

| Field | Type | Description |
|---|---|---|
| `address` | `Address` | Recipient address |
| `percentage_bps` | `u32` | Percentage in basis points (10000 = 100%) |

**`FeeCollection`**:

| Field | Type | Description |
|---|---|---|
| `token` | `Address` | Token contract address |
| `total_amount` | `i128` | Total amount collected |
| `distributed_amount` | `i128` | Amount already distributed |

### Public Functions

| Function | Auth | Parameters | Returns | Description |
|---|---|---|---|---|
| `initialize(admin)` | — | `admin: Address` | — | Init contract. |
| `grant_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Grant role. |
| `revoke_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Revoke role. |
| `pause(caller)` | `ROLE_PAUSER` | `caller: Address` | — | Pause. |
| `unpause(caller)` | `ROLE_ADMIN` | `caller: Address` | — | Unpause. |
| `set_fee_recipients(caller, recipients)` | `ROLE_FEE_MANAGER` | `caller: Address, recipients: Vec<FeeRecipient>` | — | Set recipients. Must sum to 100%. |
| `get_fee_recipients()` | — | — | `Vec<FeeRecipient>` | Get current recipients. |
| `collect_fees(token, amount)` | — | `token: Address, amount: i128` | — | Collect fees from a token. |
| `distribute_fees(caller, token)` | `ROLE_FEE_MANAGER` | `caller: Address, token: Address` | — | Distribute collected fees to recipients. |
| `get_fee_collection(token)` | — | `token: Address` | `FeeCollection` | Get collection status per token. |
| `withdraw_fees(caller, token, amount)` | `ROLE_ADMIN` | `caller: Address, token: Address, amount: i128` | — | Emergency fee withdrawal. |
| `upgrade(caller, new_wasm_hash)` | `ROLE_UPGRADER` | `caller: Address, new_wasm_hash: BytesN<32>` | — | Upgrade contract WASM. |

---

## InsurancePool Contract

**Source**: `packages/contracts/contracts/insurance_pool/src/lib.rs`
**Deployment**: Stellar Soroban, manages an insurance pool for protecting worker payments.

### Storage Map

| Key | Type | Location | Description |
|---|---|---|---|
| `Admin` | `Address` | Instance | Admin address |
| `Paused` | `bool` | Instance | Pause flag |
| `RoleMembers(Symbol)` | `Vec<Address>` | Persistent | Role member lists |
| `PoolMembers` | `Map<Address, PoolMember>` | Persistent | Pool members, keyed by member address |
| `PoolStats(Address)` | `PoolStats` | Persistent | Pool statistics per token |
| `Claims` | `Vec<Symbol>` | Persistent | List of claim IDs |
| `Claim(Symbol)` | `Claim` | Persistent | Individual claim record |

### Key Types

**`PoolMember`**:

| Field | Type | Description |
|---|---|---|
| `address` | `Address` | Member address |
| `contribution` | `i128` | Total contribution amount |
| `last_contribution_at` | `u64` | Last contribution timestamp |

**`Claim`**:

| Field | Type | Description |
|---|---|---|
| `id` | `Symbol` | Claim ID |
| `claimant` | `Address` | Claimant address |
| `amount` | `i128` | Claim amount |
| `status` | `String` | `"pending"` / `"approved"` / `"rejected"` / `"paid"` |
| `filed_at` | `u64` | Filing timestamp |
| `resolved_at` | `u64` | Resolution timestamp |

**`PoolStats`**:

| Field | Type | Description |
|---|---|---|
| `token` | `Address` | Token contract |
| `total_balance` | `i128` | Current pool balance |
| `total_contributions` | `i128` | Lifetime contributions |
| `total_claims_paid` | `i128` | Lifetime claims paid |
| `premium_bps` | `u32` | Premium rate in basis points |

### Public Functions

| Function | Auth | Parameters | Returns | Description |
|---|---|---|---|---|
| `initialize(admin, token, premium_bps)` | — | `admin: Address, token: Address, premium_bps: u32` | — | Init pool with token and premium rate. |
| `grant_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Grant role. |
| `revoke_role(caller, role, account)` | `ROLE_ADMIN` | `caller: Address, role: Symbol, account: Address` | — | Revoke role. |
| `pause(caller)` | `ROLE_PAUSER` | `caller: Address` | — | Pause. |
| `unpause(caller)` | `ROLE_ADMIN` | `caller: Address` | — | Unpause. |
| `contribute(contributor, token, amount)` | `contributor.require_auth()` | `contributor: Address, token: Address, amount: i128` | — | Contribute to the pool. |
| `file_claim(claimant, claim_id, amount)` | `claimant.require_auth()` | `claimant: Address, claim_id: Symbol, amount: i128` | — | File an insurance claim. |
| `approve_claim(caller, claim_id)` | `ROLE_CLAIMS_MGR` | `caller: Address, claim_id: Symbol` | — | Approve a pending claim. |
| `reject_claim(caller, claim_id)` | `ROLE_CLAIMS_MGR` | `caller: Address, claim_id: Symbol` | — | Reject a pending claim. |
| `pay_claim(caller, claim_id, token)` | `ROLE_CLAIMS_MGR` | `caller: Address, claim_id: Symbol, token: Address` | — | Pay out an approved claim. |
| `get_pool_stats(token)` | — | `token: Address` | `PoolStats` | Get pool statistics. |
| `get_pool_members()` | — | — | `Vec<PoolMember>` | List every pool member. |
| `get_pool_member(address)` | — | `address: Address` | `Option<PoolMember>` | Look up a single pool member. |
| `get_claim(claim_id)` | — | `claim_id: Symbol` | `Claim` | Get claim details. |
| `rebalance_pool(caller, token, new_premium_bps)` | `ROLE_ADMIN` | `caller: Address, token: Address, new_premium_bps: u32` | — | Adjust premium rate. |
| `upgrade(caller, new_wasm_hash)` | `ROLE_UPGRADER` | `caller: Address, new_wasm_hash: BytesN<32>` | — | Upgrade contract WASM. |

---

## Event Catalogue

### Registry Contract Events

| Event | Topics | Data | Description |
|---|---|---|---|
| `WorkerRegistered` | `("WorkerRegistered", id: Symbol)` | `(owner: Address, category: Symbol)` | New worker registered |
| `WorkerToggled` | `("WorkerToggled", id: Symbol)` | `new_status: bool` | Worker active status toggled |
| `WrkUpd` | `("WrkUpd", id: Symbol, caller: Address)` | `(name: String, category: Symbol, wallet: Address)` | Worker profile updated |
| `WrkDrg` | `("WrkDrg", id: Symbol, caller: Address)` | `()` | Worker deregistered |
| `RlGrnt` | `("RlGrnt", role: Symbol, account: Address)` | `()` | Role granted |
| `RlRvkd` | `("RlRvkd", role: Symbol, account: Address)` | `()` | Role revoked |
| `CurAdd` | `("CurAdd", admin: Address, curator: Address)` | `()` | Curator added |
| `CurRem` | `("CurRem", admin: Address, curator: Address)` | `()` | Curator removed |
| `DlgAdd` | `("DlgAdd", id: Symbol, delegate: Address)` | `expires_at: u64` | Delegate added |
| `DlgRem` | `("DlgRem", id: Symbol, delegate: Address)` | `()` | Delegate removed |
| `ContractPaused` | `("ContractPaused", admin: Address)` | `()` | Contract paused |
| `ContractUnpaused` | `("ContractUnpaused", admin: Address)` | `()` | Contract unpaused |
| `RepUpd` | `("RepUpd", id: Symbol)` | `score: u32` | Reputation updated |
| `RevSub` | `("RevSub", worker_id: Symbol)` | `(reviewer: Address, rating: u32, new_reputation: u32)` | Review submitted |
| `JobComp` | `("JobComp", worker_id: Symbol)` | `(tip_count: u32, new_reputation: u32)` | Job completion recorded |
| `RepSlash` | `("RepSlash", worker_id: Symbol)` | `(slash_bps: u32, new_reputation: u32)` | Reputation slashed |
| `RepSlashed` | `("RepSlashed", worker_id: Symbol)` | `(avg_rating: u32, slashed_rep: u32)` | Auto-slash triggered by low rating |
| `RevUpd` | `("RevUpd", id: Symbol)` | `(review_count: u32, avg_rating: u32)` | Review aggregate updated |
| `SubUpd` | `("SubUpd", id: Symbol)` | `(tier: u32, expires_at: u64)` | Subscription updated |
| `SubRnw` | `("SubRnw", id: Symbol)` | `new_expires_at: u64` | Subscription renewed |
| `CatVfy` | `("CatVfy", worker_id: Symbol, category: Symbol)` | `(curator: Address, expires_at: u64)` | Category verified |
| `LocVfy` | `("LocVfy", worker_id: Symbol)` | `(verifier: Address, verified_at: u64, expires_at: u64)` | Location verified |
| `AvlUpd` | `("AvlUpd", id: Symbol)` | `(is_available: bool, updated_at: u64, expires_at: u64)` | Availability updated |
| `Staked` | `("Staked", worker_id: Symbol, caller: Address)` | `(amount: i128, total_staked: i128)` | Tokens staked |
| `UnstakeRq` | `("UnstakeRq", worker_id: Symbol, caller: Address)` | `now: u64` | Unstake requested |
| `Unstaked` | `("Unstaked", worker_id: Symbol, caller: Address)` | `(staked: i128, rewards: i128)` | Unstake finalised |
| `BdgAwd` | `("BdgAwd", worker_id: Symbol, badge_id: Symbol)` | `(issuer: Address, name: String)` | Badge awarded |
| `BdgRvk` | `("BdgRvk", worker_id: Symbol, badge_id: Symbol)` | `caller: Address` | Badge revoked |
| `MetUpd` | `("MetUpd", worker_id: Symbol)` | `(jobs_completed: u32, avg_rating: u32, performance_score: u32)` | Metrics updated |
| `CatAdded` | `("CatAdded", name: Symbol)` | `()` | Category added |
| `CatRemoved` | `("CatRemoved", name: Symbol)` | `()` | Category removed |
| `UpgPropsd` | `("UpgPropsd", execute_after_ledger: u32)` | `()` | Upgrade proposed |
| `UpgExecd` | `("UpgExecd",)` | `()` | Upgrade executed |
| `UpgCancld` | `("UpgCancld",)` | `()` | Upgrade cancelled |
| `Migrated` | `("Migrated",)` | `(old_version: u32, new_version: u32)` | Schema migration completed |
| `WorkerTTLExtended` | `("WorkerTTLExtended", id: Symbol)` | `()` | Worker TTL extended |
| `WorkerListTTLExtended` | `("WorkerListTTLExtended",)` | `()` | Worker list TTL extended |

### Market Contract Events

| Event | Topics | Data | Description |
|---|---|---|---|
| `RlGrnt` | `("RlGrnt", role: Symbol, account: Address)` | `()` | Role granted |
| `RlRvkd` | `("RlRvkd", role: Symbol, account: Address)` | `()` | Role revoked |
| `Paused` | `("Paused", admin: Address)` | `()` | Contract paused |
| `Unpaused` | `("Unpaused", admin: Address)` | `()` | Contract unpaused |
| `TrsSet` | `("TrsSet", caller: Address)` | `new_treasury: Address` | Treasury updated |
| `TipSent` | `("TipSent", from: Address, to: Address)` | `(token_addr: Address, amount: i128)` | Direct tip sent |
| `FeeTaken` | `("FeeTaken",)` | `(fee: i128, fee_recipient: Address)` | Protocol fee deducted |
| `EscCrt` | `("EscCrt", id: Symbol, from: Address)` | `(to: Address, token_addr: Address, amount: i128, expiry: u64)` | Escrow created |
| `EscRel` | `("EscRel", id: Symbol, to: Address)` | `amount: i128` | Escrow released |
| `EscCnl` | `("EscCnl", id: Symbol, from: Address)` | `amount: i128` | Escrow cancelled |
| `EscExp` | `("EscExp", id: Symbol, from: Address)` | `amount: i128` | Expired escrow cancelled by third party |
| `MsEscCrt` | `("MsEscCrt", id: Symbol, from: Address)` | `(to: Address, amount: i128, threshold: u32)` | Multi-sig escrow created |
| `MsEscApv` | `("MsEscApv", id: Symbol, caller: Address)` | `approvals_count: u32` | Multi-sig approval |
| `MsEscRel` | `("MsEscRel", id: Symbol, to: Address)` | `amount: i128` | Multi-sig released |
| `MsEscCnl` | `("MsEscCnl", id: Symbol, from: Address)` | `amount: i128` | Multi-sig cancelled |
| `MsArbReq` | `("MsArbReq", escrow_id: Symbol, caller: Address)` | `(arbitrator: Address, fee: i128)` | Multi-sig arbitration requested |
| `MsArbRes` | `("MsArbRes", escrow_id: Symbol, arbitrator: Address)` | `release_to_worker: bool` | Multi-sig arbitration resolved |
| `ArbAdd` | `("ArbAdd", admin: Address, arbitrator: Address)` | `()` | Arbitrator added |
| `ArbRem` | `("ArbRem", admin: Address, arbitrator: Address)` | `()` | Arbitrator removed |
| `ArbReq` | `("ArbReq", escrow_id: Symbol, caller: Address)` | `(arbitrator: Address, fee: i128)` | Standard arbitration requested |
| `ArbRes` | `("ArbRes", escrow_id: Symbol, arbitrator: Address)` | `release_to_worker: bool` | Standard arbitration resolved |
| `Migrated` | `("Migrated",)` | `(old_version: u32, new_version: u32)` | Schema migration |

### Dispute Contract Events

| Event | Topics | Data | Description |
|---|---|---|---|
| `Init` | `("Init",)` | `admin: Address` | Contract initialized |
| `Paused` | `("Paused", admin: Address)` | `()` | Paused |
| `Unpaused` | `("Unpaused", admin: Address)` | `()` | Unpaused |
| `ArbAdd` | `("ArbAdd",)` | `arbitrator: Address` | Arbitrator added |
| `ArbRem` | `("ArbRem",)` | `arbitrator: Address` | Arbitrator removed |
| `DspOpen` | `("DspOpen", id: Symbol, disputer: Address)` | `(respondent: Address, amount: i128)` | Dispute filed |
| `DspEvid` | `("DspEvid", dispute_id: Symbol, caller: Address)` | `()` | Evidence submitted |
| `DspDcide` | `("DspDcide", dispute_id: Symbol, arbitrator: Address)` | `(outcome: u32, split_bps: u32)` | Arbitrator decision recorded (no transfer yet) |
| `DspSettle` | `("DspSettle", dispute_id: Symbol)` | `(outcome: u32, amount: i128)` | Settlement executed |

### FeeDistribution Contract Events

| Event | Topics | Data | Description |
|---|---|---|---|
| `Init` | `("Init", admin: Address)` | `()` | Contract initialized |
| `RlGrnt` | `("RlGrnt", role: Symbol, account: Address)` | `()` | Role granted |
| `RlRvkd` | `("RlRvkd", role: Symbol, account: Address)` | `()` | Role revoked |
| `Paused` | `("Paused", caller: Address)` | `()` | Paused |
| `Unpaused` | `("Unpaused", caller: Address)` | `()` | Unpaused |
| `FeeRcp` | `("FeeRcp",)` | `count: u32` | Fee recipients updated |
| `FeeColl` | `("FeeColl", token: Address)` | `amount: i128` | Fees collected |
| `FeeDistr` | `("FeeDistr", recipient: Address, share: i128)` | `()` | Fees distributed |
| `FeeWdraw` | `("FeeWdraw", token: Address)` | `amount: i128` | Emergency fee withdrawal |
| `Upgrade` | `("Upgrade", caller: Address)` | `()` | Contract upgraded |

### InsurancePool Contract Events

| Event | Topics | Data | Description |
|---|---|---|---|
| `Init` | `("Init", admin: Address)` | `premium_bps: u32` | Contract initialized |
| `RlGrnt` | `("RlGrnt", role: Symbol, account: Address)` | `()` | Role granted |
| `RlRvkd` | `("RlRvkd", role: Symbol, account: Address)` | `()` | Role revoked |
| `Paused` | `("Paused", caller: Address)` | `()` | Paused |
| `Unpaused` | `("Unpaused", caller: Address)` | `()` | Unpaused |
| `Contrib` | `("Contrib", contributor: Address)` | `amount: i128` | Contribution made |
| `ClmFile` | `("ClmFile", claimant: Address)` | `amount: i128` | Claim filed |
| `ClmAppr` | `("ClmAppr", claim_id: Symbol)` | `amount: i128` | Claim approved |
| `ClmRej` | `("ClmRej", claim_id: Symbol)` | `amount: i128` | Claim rejected |
| `ClmPay` | `("ClmPay", claim_id: Symbol)` | `amount: i128` | Claim paid out |
| `Rebal` | `("Rebal", token: Address)` | `new_premium_bps: i128` | Pool rebalanced |
| `Upgrade` | `("Upgrade", caller: Address)` | `()` | Contract upgraded |

---

## Cross-References

| Document | Link |
|---|---|
| Contract Integration Guide (client-side SDK usage) | [CONTRACT_INTEGRATION.md](./CONTRACT_INTEGRATION.md) |
| In-repo TypeScript SDK (`@bluecollar/sdk`) | [packages/sdk/README.md](../packages/sdk/README.md) |
| Interface Versioning Policy | [packages/contracts/VERSIONING.md](../packages/contracts/VERSIONING.md) |
| Contracts Package Overview | [packages/contracts/README.md](../packages/contracts/README.md) |
| Upgrade Runbook & WASM deployment | [contract-upgrade-guide.md](./contract-upgrade-guide.md) |
| Architecture Overview | [system-overview.svg](./architecture/system-overview.svg) |
| Environment Variables | [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) |
| Contract Testing Guide | [CONTRACT_TESTING.md](./CONTRACT_TESTING.md) |

---

> **Maintenance**: Update this file whenever contract public functions, storage keys, events, or authorization rules change. Keep the function signature tables in sync with `lib.rs`. Update the event catalogue whenever events are added or modified.
