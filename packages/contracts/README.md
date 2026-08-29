# BlueCollar Contracts

Stellar **Soroban** smart contracts for the BlueCollar protocol, written in Rust.

| Contract | Description |
|---|---|
| `registry` | On-chain worker registrations, curator management, staking, badges |
| `market` | Token tips, escrow payments, arbitration, protocol fee |
| `dispute` | Full dispute lifecycle — file → evidence → arbitrator decision → settle |
| `fee_distribution` | Protocol fee collection and percentage-based distribution to multiple recipients |
| `insurance_pool` | On-chain insurance pool for worker payments — contributions, claims, rebalancing |

Every public function on every contract is documented with rustdoc (`///`) comments in
its `lib.rs`. The consolidated, per-contract reference — function signatures, storage
maps, event catalogue, and the common auth/TTL/upgrade patterns shared across all five
contracts — lives in **[docs/CONTRACTS.md](../../docs/CONTRACTS.md)**. See
[VERSIONING.md](./VERSIONING.md) for how interface changes are versioned across
releases (distinct from the WASM upgrade mechanics below).

---

## Minimum Supported Versions

| Tool | Minimum version | Notes |
|---|---|---|
| Rust (stable) | **1.74.0** | Soroban SDK 26.x requires this edition and feature set |
| soroban-sdk | **26.1.0** | All contracts pin to this version for ABI consistency |
| Stellar CLI | **21.x** | Used for `stellar contract deploy / invoke / install` |
| wasm32v1-none | (bundled with Rust) | Added via `rustup target add wasm32v1-none` |

> All member crates in the workspace declare `soroban-sdk = "26.1.0"` (except the
> `fuzz` crate which also accepts `"26.1.0"`). Do **not** mix SDK versions across
> contracts — the Soroban host environment enforces ABI compatibility and mismatched
> versions cause silent runtime panics.

---

## Prerequisites

```bash
# Rust + wasm target
rustup target add wasm32v1-none

# Stellar CLI
cargo install --locked stellar-cli

# Fund a testnet account (one-time)
stellar keys generate --global deployer
stellar keys fund deployer --network testnet
```

---

## Build

```bash
cd packages/contracts

# Build both contracts
make build

# Or individually
make build-registry
make build-market
```

WASM outputs land in `target/wasm32v1-none/release/`.

## Coverage

[![Contracts Coverage](https://github.com/Blue-Kollar/Blue-Collar/actions/workflows/enhanced-ci-cd.yml/badge.svg?branch=main)](https://github.com/Blue-Kollar/Blue-Collar/actions/workflows/enhanced-ci-cd.yml)

Run contract coverage locally from `packages/contracts`:

```bash
rustup component add llvm-tools-preview
cargo install --locked cargo-llvm-cov
cargo llvm-cov --workspace --lcov --output-path target/coverage/lcov.info --fail-under-lines 80
```

The CI job uploads the generated coverage report as an artifact from `packages/contracts/target/coverage`.

---

## Testing

### Unit & Integration Tests

Run the standard test suite:

```bash
cd packages/contracts
cargo test --workspace
```

### Cross-Contract Integration Tests

Per-contract tests live in each crate's `src/test.rs` and cover that contract alone. Tests that
chain two or more contracts together live in `contracts/integration/tests/`, run against the
in-process Soroban testnet, and deploy fresh instances per test. Shared deployment helpers are in
`tests/common/mod.rs`; add new ones there rather than duplicating setup per file.

| File | Flow covered |
| --- | --- |
| `e2e.rs` | Registry worker registration and status toggling; market tips with fee split; market escrow create and release; register a worker then tip them |
| `dispute_flow.rs` | Dispute filed on locked funds, evidence from both parties, arbitrator decides a split, settlement pays each side its share; market escrow arbitration driven by the dispute contract's ruling; escrow contract dispute resolved against the worker refunds the depositor |
| `insurance_flow.rs` | Escrowed job lost at arbitration, the covered party files an insurance claim, the claims manager approves and pays it, pool balance and claim totals reconcile |
| `reputation_flow.rs` | Completed escrow jobs feed reviews that raise a worker's score and earn a badge; a dispute resolved against the worker slashes the score and revokes the badge |

Run one flow at a time with:

```bash
cargo test -p bluecollar-integration --test dispute_flow
```

When adding a cross-contract scenario, extend the matching file if the flow fits an existing area,
or add a new `*_flow.rs` file plus a row in this table.

### Fuzz Testing

The `fuzz` crate includes property-based tests using `proptest` that verify critical contract invariants
with randomly generated inputs. These tests focus on amount validation, authorization edge cases,
and state transitions for payment, escrow, and registry contracts.

Run property-based fuzz tests:

```bash
cd packages/contracts/contracts/fuzz
cargo test --test "*_fuzz" --features testutils
```

**Test coverage includes:**
- `payment_fuzz.rs` — Lock/release/refund payments, fee deduction, amount safety
- `escrow_fuzz.rs` — Create/release/cancel escrow, expiry handling, state transitions
- `registry_fuzz.rs` — Worker registration, reputation updates, delegation
- `market_fuzz.rs` — Tip transfers, escrow creation, fee calculations
- `upgrade_fuzz.rs` — Contract upgrade mechanics

**Key invariants tested:**
- ✓ Amounts never overflow or underflow
- ✓ Zero amounts are rejected
- ✓ Fee calculations remain correct across all fee rates (0–500 bps)
- ✓ Authorization checks prevent unauthorized actions
- ✓ State transitions preserve invariants (e.g., locked payments cannot be double-released)

---

## Deploy

### Testnet (quick start)

```bash
make deploy-testnet \
  SOURCE=deployer \
  ADMIN=<your-stellar-address> \
  FEE_RECIPIENT=<treasury-address> \
  FEE_BPS=100
```

This runs `deploy-registry.sh` then `deploy-market.sh` and writes both contract IDs
to `deployments.json`.

### Mainnet

```bash
make deploy-mainnet \
  SOURCE=<mainnet-key-alias> \
  ADMIN=<admin-address> \
  FEE_RECIPIENT=<treasury-address> \
  FEE_BPS=100
```

### Manual (per-contract)

```bash
# Registry
./scripts/deploy-registry.sh \
  --network testnet \
  --source deployer \
  --admin <admin-address>

# Market
./scripts/deploy-market.sh \
  --network testnet \
  --source deployer \
  --admin <admin-address> \
  --fee-bps 100 \
  --fee-recipient <treasury-address>
```

### deployments.json

After each deploy the contract IDs are stored in `deployments.json`:

```json
{
  "testnet": {
    "registry": {
      "contract_id": "C...",
      "admin": "G...",
      "deployed_at": "2026-01-01T00:00:00Z"
    },
    "market": {
      "contract_id": "C...",
      "admin": "G...",
      "fee_bps": 100,
      "fee_recipient": "G...",
      "deployed_at": "2026-01-01T00:00:00Z"
    }
  }
}
```

---

## Upgrading a Contract

Upgrades preserve the contract ID and all storage.

```bash
# 1. Install new WASM, get its hash
stellar contract install \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source <admin-key> \
  --network testnet
# → <new_wasm_hash>

# 2. Invoke upgrade
stellar contract invoke \
  --id <contract-id> \
  --source <admin-key> \
  --network testnet \
  -- upgrade \
  --new_wasm_hash <new_wasm_hash>

# 3. If the storage schema changed, run migrate
stellar contract invoke \
  --id <contract-id> \
  --source <admin-key> \
  --network testnet \
  -- migrate \
  --admin <admin-address> \
  --expected_version <N>
```

See [SECURITY.md](./SECURITY.md#8-migration-pattern) for the full migration pattern.

---

## Storage TTL

Soroban persistent entries expire after a TTL measured in ledgers.

| Constant | Value | Approx. duration |
|---|---|---|
| `TTL_EXTEND_TO` | 535,000 ledgers | ~1 year |
| `TTL_THRESHOLD` | 267,500 ledgers | ~6 months |

Every write automatically extends the TTL. A public `extend_worker_ttl(id)` function
lets anyone refresh a worker entry without special permissions.

---

## Security

See [SECURITY.md](./SECURITY.md) for the full threat model, auth table, overflow
analysis, and migration pattern.

## Further reading

| Document | Covers |
|---|---|
| [docs/CONTRACTS.md](../../docs/CONTRACTS.md) | Full interface reference: functions, storage, events, per-contract |
| [VERSIONING.md](./VERSIONING.md) | Interface/semver versioning policy for public functions |
| [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md) | WASM upgrade runbook (build → install → invoke `upgrade`/`migrate`) |
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Integrating against the deployed contracts |
| [SECURITY.md](./SECURITY.md) | Threat model, auth table, overflow analysis |
| [CERTIFICATION_TRACKING.md](./CERTIFICATION_TRACKING.md) | Registry's certification sub-API in depth |
| [ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md) | Architectural decision on monorepo package boundaries |
| [ADR 0002: Soroban Smart Contract Upgrade Strategy](../../docs/adr/0002-soroban-contract-upgrade-strategy.md) | Architectural decision on Soroban in-place WASM upgrades and governance |
