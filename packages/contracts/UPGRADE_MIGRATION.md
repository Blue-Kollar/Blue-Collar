# Contract Upgrade & Storage-Migration Reference

Issue #1445 — per-contract upgrade mechanism documentation, storage-breaking risk
register, and the test map for upgrade/migration coverage.

An upgrade on Soroban is always **two steps**:

1. **WASM swap** — `env.deployer().update_current_contract_wasm(new_wasm_hash)`
   replaces the code behind an *unchanged contract ID*. Instance and persistent
   storage are untouched by the swap itself.
2. **Schema migration** — if the new code reads/writes storage differently, the
   admin calls `migrate(admin, expected_version)` to transform or backfill
   existing ledger entries and advance `SchemaVersion` by exactly one.

Skipping step 2 after a layout change is the classic way to brick a contract:
the new WASM starts reading old keys with new expectations. The `migrate`
contract below is the safety net that makes that failure explicit instead of
silent.

> Operational step-by-step (build, install, verify) lives in
> [`UPGRADE_GUIDE.md`](UPGRADE_GUIDE.md); the design rationale is in
> [`docs/adr/0002-soroban-contract-upgrade-strategy.md`](../docs/adr/0002-soroban-contract-upgrade-strategy.md).

## 1. Upgrade mechanism per contract

| Contract | WASM-swap entry point | Authorization | Timelock | `migrate` | `get_schema_version` |
|---|---|---|---|---|---|
| **registry** | `upgrade(new_wasm_hash)` | stored admin must hold `ROLE_UPGRADER` | ✅ `propose_upgrade` / `execute_upgrade` / `cancel_upgrade` (`TIMELOCK_LEDGERS = 34_560` ≈ 48 h) | ✅ `migrate(admin, expected_version)` — `ROLE_ADMIN` | ✅ |
| **job_registry** | `upgrade(caller, new_wasm_hash)` | caller holds `ROLE_UPGRADER` | ❌ | ✅ `migrate(admin, expected_version)` — `ROLE_ADMIN` | ✅ |
| **market** | `upgrade(new_wasm_hash)` | stored admin holds `ROLE_UPGRADER` | ❌ | ✅ `migrate(admin, expected_version)` | ✅ |
| **escrow** | `upgrade(caller, new_wasm_hash)` | caller holds `ROLE_UPGRADER` | ❌ | ✅ `migrate(admin, expected_version)` | ✅ |
| **dispute** | `upgrade(env, admin, new_wasm_hash)` | `require_admin` | ❌ | ❌ | ❌ |
| **reputation** | `upgrade(caller, new_wasm_hash)` | caller holds `ROLE_UPGRADER` | ❌ | ❌ (has `SchemaVersion` key) | ❌ |
| **payment** | `upgrade(caller, new_wasm_hash)` | caller holds `ROLE_UPGRADER` | ❌ | ❌ (has `SchemaVersion` key) | ❌ |
| **fee_distribution** | `upgrade(caller, new_wasm_hash)` | caller holds `ROLE_UPGRADER` | ❌ | ❌ | ❌ |
| **insurance_pool** | `upgrade(caller, new_wasm_hash)` | caller holds `ROLE_UPGRADER` | ❌ | ❌ | ❌ |

Notes:

- **Signature asymmetry is intentional-but-legacy**: `registry` and `market`
  resolve the upgrader from the stored admin (no `caller` argument); the rest
  take `caller` explicitly. Do **not** reorder or drop arguments — the
  signature is part of the client-facing ABI, and existing tooling/tests call
  it as-is.
- `registry` is the only contract with a **timelocked** path. Anyone may call
  `execute_upgrade` after the 48-hour window; the proposal itself requires
  `ROLE_UPGRADER` and only one proposal may be pending at a time
  (`PendingUpgrade { wasm_hash, execute_after_ledger }`, persistent key
  `DataKey::PendingUpgrade`).
- Contracts marked ❌ for `migrate` only need one **if** their storage layout
  changes; an additive-only upgrade needs no migration. `reputation` and
  `payment` already persist a `SchemaVersion` key but never expose it — adding
  `migrate`/`get_schema_version` (copy the `job_registry` implementation) is
  required before their first layout change.

## 2. Storage layout per contract (upgrade-relevant)

### registry (`contracts/registry/src/storage.rs`)

| Domain | Keys |
|---|---|
| **instance** | `Paused` |
| **persistent** | `Admin`, `RoleMembers(u64)`, `Curators`, `Worker(Symbol)`, `WorkerList`, `CategoryVerification(Symbol, Symbol)`, `StakeInfo(Symbol)`, `PerformanceMetrics(Symbol)`, `Delegates(Symbol)`, `WorkerBadges(Symbol)`, `Badge(Symbol, Symbol)`, `Subscription(Symbol)`, `SchemaVersion`, `LocationVerification(Symbol)`, `AvailabilityStatus(Symbol)`, `Categories`, `WorkerCount`, `PendingUpgrade`, `ReputationHistory(Symbol)`, `ReputationInputs(Symbol)`, `VerificationLevel(Symbol)`, `CertifiedSkills(Symbol)` |

- `SchemaVersion` is persistent, defaults to `1` when absent
  (`storage::get_schema_version`), written once by `initialize`.
- TTL constants: `TTL_THRESHOLD = 267_500`, `TTL_EXTEND_TO = 535_000`;
  extended on worker writes and via `extend_worker_ttl`.

### job_registry (`contracts/job_registry/src/storage.rs`)

| Domain | Keys |
|---|---|
| **instance** | `Initialized`, `Paused` |
| **persistent** | `Admin`, `RoleMembers(u64)`, `Job(Symbol)`, `JobList`, `PosterJobs(Address)`, `SchemaVersion` |

- `SchemaVersion` is written to `1` during `initialize`; reads default to `1`
  for deployments that predate the key.

No contract in the workspace uses temporary storage, so archive/restore and
TTL-expiry concerns apply only to the persistent entries above.

## 3. Storage-breaking risks identified

| # | Risk | Where | Mitigation |
|---|---|---|---|
| R1 | **Doc/impl mismatch on `DataKey::Admin`**: doc said "instance storage" while the code reads/writes *persistent*. Anyone "fixing" the mismatch by moving the key would orphan the existing admin entry and brick authorization. | `registry/src/storage.rs` | Doc corrected to describe reality (persistent); the location itself must **not** change. Rule: fix the comment, never the storage domain. |
| R2 | **Renaming `DataKey` variants or struct fields** changes the on-chain encoding; old entries then fail to decode. | all contracts | Append-only `DataKey` growth. Existing variants/fields are frozen; deprecate, don't rename. |
| R3 | **Moving a key between instance/persistent/temporary domains** silently orphans the old entry (the swap itself never rewrites storage). | all contracts | Same append-only rule; covered by the upgrade-simulation tests that read every domain after `migrate`. |
| R4 | **Registry had no `migrate` entry point** even though its tests, fuzz targets, CI gate and `UPGRADE_GUIDE.md` all assumed one — a layout-changing upgrade would have had no supported migration path. | `registry` | ✅ `migrate(admin, expected_version)` added (mirrors `escrow`/`market`); role-gated on `ROLE_ADMIN`, rejects stale/replayed versions with `WrongSchemaVersion`. |
| R5 | **job_registry wrote `SchemaVersion` at init but never exposed a getter or migrator**, so no client could ever observe or advance it. | `job_registry` | ✅ `get_schema_version` + `migrate` added; storage helpers `storage::get/set_schema_version` added. |
| R6 | **Defaulted versioning**: an unset `SchemaVersion` reads as `1`, so a hypothetical pre-v1 layout would be indistinguishable from v1. | registry, job_registry, escrow, market | Acceptable today (baseline is genuinely v1); first real layout change must set the key explicitly in `initialize` *and* in `migrate`. |
| R7 | **`upgrade()` signature asymmetry** across contracts (with/without `caller`) invites copy-paste ABI breaks. | registry, market vs rest | Documented in §1; changing a signature counts as a breaking client change and needs a coordinated release. |
| R8 | **TTL decay around upgrades**: the WASM swap does not extend TTLs; persistent entries near expiry can be archived between proposal and execution. | registry (48 h timelock), job_registry | Refresh via `extend_worker_ttl` / normal writes before executing; `migrate` rewrites touched entries (extending their TTL as a side effect of `set`). |
| R9 | **Replay/out-of-order migration** corrupting already-migrated state. | contracts with `migrate` | `expected_version` must equal current version; replay → `WrongSchemaVersion`. Tested for both registry and job_registry. |

## 4. Runbook: upgrading a contract

```bash
# 1. Build the new WASM and record its hash
stellar contract build   # target/wasm32v1-none/release/<name>.wasm
stellar contract upload --wasm <path> --network testnet   # → NEW_WASM_HASH

# 2. Swap the code (registry: via the timelocked path)
stellar contract invoke --id <ID> -- ... -- propose_upgrade --admin <ADMIN> --new_wasm_hash <NEW_WASM_HASH>
# ...wait TIMELOCK_LEDGERS...
stellar contract invoke --id <ID> -- ... -- execute_upgrade

# 3. Migrate storage if (and only if) the layout changed
stellar contract invoke --id <ID> -- ... -- get_schema_version      # → N
stellar contract invoke --id <ID> -- ... -- migrate --admin <ADMIN> --expected_version N   # → N+1

# 4. Verify
stellar contract invoke --id <ID> -- ... -- version                 # event schema
stellar contract invoke --id <ID> -- ... -- get_schema_version      # storage schema
```

Contracts without `migrate` skip step 3 — but only while their layout is
unchanged. If you add fields, add `migrate` first (copy `job_registry`).

## 5. Test coverage map (upgrade simulation)

| What | Where |
|---|---|
| **registry upgrade simulation**: pre-existing state → timelocked proposal → `migrate` → integrity + version bump; replay rejected; non-admin rejected; sequential bumps | `contracts/registry/src/test.rs` → `mod upgrade_simulation` |
| registry backward-compat + security regression (role gates, timelock, double-proposal) | `contracts/registry/src/test.rs` → `mod backward_compat`, `mod security_regression` |
| **job_registry upgrade simulation**: jobs/indexes/roles written under v1 → `migrate` → byte-identical reads; baseline version; auth/version/replay guards | `contracts/job_registry/src/test.rs` → `test_upgrade_simulation_*`, `test_migrate_*` |
| job_registry WASM-swap role gate | `contracts/job_registry/src/test.rs` → `test_upgrade_*` |
| market upgrade framework | `contracts/market/src/test.rs` → `mod upgrade_framework` |
| Property tests: migration over arbitrary worker/escrow state preserves every field and bumps the version by exactly one | `contracts/fuzz/tests/upgrade_fuzz.rs`, `contracts/fuzz/fuzz_targets/fuzz_migrate.rs` |
| CI gate that runs all of the above on every PR | `.github/workflows/contract-tests.yml` → `upgrade-safety` job |

**Scope note on "real" WASM swaps in tests:** the in-process Soroban test host
cannot install a WASM blob from a dummy hash, and no `.wasm` artifact is
checked in, so the unit tests simulate an upgrade as *pre-existing storage +
the migration step* (step 2) while asserting the role gate and timelock of
step 1. The actual byte-for-byte swap is exercised by the `wasm-build` CI job
plus a testnet dry run, as described in
[`docs/contract-upgrade-guide.md`](../docs/contract-upgrade-guide.md).

## 6. Acceptance checklist (issue #1445)

- [x] Upgrade mechanism documented per contract — §1
- [x] Upgrade-simulation test for registry — `mod upgrade_simulation`
- [x] Upgrade-simulation test for job_registry — `test_upgrade_simulation_*`
- [x] Storage-breaking risks identified and mitigated — §3 (R4/R5 fixed in
      code, R1 doc corrected, R2/R3/R6–R9 guarded/tested)
- [x] Migration helper functions added — `registry::migrate`,
      `job_registry::migrate`, `job_registry::storage::get/set_schema_version`
- [x] Related tests passing — `cargo test --workspace`
