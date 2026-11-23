# BlueCollar Contracts — Security & Threat Model

This document covers the security posture of the BlueCollar Soroban smart contracts
(`registry` and `market`) and is intended as a reference for third-party security audits.

---

## 1. Access Control

### Registry Contract

| Function                                 | Auth required                | Role                            |
| ---------------------------------------- | ---------------------------- | ------------------------------- |
| `initialize`                             | none (one-shot)              | —                               |
| `grant_role` / `revoke_role`             | `require_auth()` on caller   | `ROLE_ADMIN`                    |
| `add_curator` / `remove_curator`         | `require_auth()` on caller   | `ROLE_CURATOR_MGR`              |
| `register` / `batch_register`            | `require_auth()` on curator  | curator list                    |
| `toggle` / `update` / `update_worker`    | `require_auth()` on caller   | owner or delegate               |
| `deregister`                             | `require_auth()` on caller   | owner only                      |
| `update_reputation`                      | `require_auth()` on caller   | `ROLE_REP_MGR`                  |
| `update_reviews` / `update_subscription` | `require_auth()` on caller   | `ROLE_ADMIN`                    |
| `verify_category`                        | `require_auth()` on curator  | curator list                    |
| `verify_location`                        | `require_auth()` on verifier | any (verifier self-attests)     |
| `update_availability`                    | `require_auth()` on caller   | owner only                      |
| `stake` / `request_unstake` / `unstake`  | `require_auth()` on caller   | owner only                      |
| `award_badge`                            | `require_auth()` on issuer   | `ROLE_ADMIN` or curator         |
| `revoke_badge`                           | `require_auth()` on caller   | `ROLE_ADMIN` or original issuer |
| `upgrade`                                | `require_auth()` on caller   | `ROLE_UPGRADER`                 |
| `pause` / `unpause`                      | `require_auth()` on caller   | `ROLE_PAUSER`                   |
| `migrate`                                | `require_auth()` on caller   | `ROLE_ADMIN`                    |

### Market Contract

| Function                               | Auth required                  | Role                      |
| -------------------------------------- | ------------------------------ | ------------------------- |
| `initialize`                           | none (one-shot)                | —                         |
| `grant_role` / `revoke_role`           | `require_auth()` on caller     | `ROLE_ADMIN`              |
| `update_fee`                           | `require_auth()` on caller     | `ROLE_FEE_MANAGER`        |
| `set_treasury`                         | `require_auth()` on caller     | `ROLE_ADMIN`              |
| `tip`                                  | `require_auth()` on `from`     | payer                     |
| `create_escrow`                        | `require_auth()` on `from`     | payer                     |
| `release_escrow`                       | `require_auth()` on caller     | `from` or `to`            |
| `cancel_escrow`                        | `require_auth()` on caller     | `from` only, after expiry |
| `cancel_expired_escrow`                | none                           | anyone                    |
| `create_multisig_escrow`               | `require_auth()` on `from`     | payer                     |
| `approve_multisig_release`             | `require_auth()` on caller     | signer                    |
| `cancel_multisig_escrow`               | `require_auth()` on caller     | `from` only, after expiry |
| `add_arbitrator` / `remove_arbitrator` | `require_auth()` on admin      | `ROLE_ADMIN`              |
| `request_arbitration`                  | `require_auth()` on caller     | `from` or `to`            |
| `resolve_arbitration`                  | `require_auth()` on arbitrator | assigned arbitrator       |
| `upgrade`                              | `require_auth()` on caller     | `ROLE_UPGRADER`           |
| `pause` / `unpause`                    | `require_auth()` on caller     | `ROLE_PAUSER`             |
| `migrate`                              | `require_auth()` on caller     | `ROLE_ADMIN`              |

**Finding:** Every state-mutating function calls `require_auth()` on the appropriate
principal before performing any state changes. View functions (`get_*`, `list_*`,
`is_*`) are read-only and require no auth.

---

## 2. Integer Overflow

All arithmetic that could overflow uses Rust's checked arithmetic methods:

- `checked_add`, `checked_sub`, `checked_mul`, `checked_div` — panics with a clear
  message rather than silently wrapping.

### Registry — affected calculations

| Location                      | Operation                   | Protection                                  |
| ----------------------------- | --------------------------- | ------------------------------------------- |
| `stake`                       | reward accumulation         | `checked_mul`, `checked_div`, `checked_add` |
| `unstake`                     | final reward + total return | `checked_mul`, `checked_div`, `checked_add` |
| `update_metrics`              | weighted average rating     | `checked_mul`, `checked_add`                |
| `calculate_performance_score` | score components            | `checked_mul`, `checked_add`                |

### Market — affected calculations

| Location | Operation                       | Protection                                  |
| -------- | ------------------------------- | ------------------------------------------- |
| `tip`    | fee = amount × fee_bps / 10_000 | `checked_mul`, `checked_div`, `checked_sub` |

---

## 3. Re-entrancy

Soroban executes each contract invocation in a **single-threaded, sandboxed WASM
environment**. There is no concept of callbacks or fallback functions as in EVM.
Cross-contract calls (e.g. `token::Client::transfer`) are synchronous and complete
before execution returns to the caller.

**Conclusion:** Classical re-entrancy attacks are not possible in Soroban. However,
as a defence-in-depth measure, all contracts follow the **checks-effects-interactions**
pattern: state is updated before any token transfer is made.

---

## 4. Storage Type Consistency

All persistent and instance storage values use types annotated with `#[contracttype]`,
which ensures ABI-stable serialisation via the Soroban XDR codec:

- `Worker`, `WorkerSubscription`, `SubscriptionTier`
- `Delegate`, `CategoryVerification`, `LocationVerification`
- `AvailabilityStatus`, `StakeInfo`, `PerformanceMetrics`
- `Badge`, `BatchRegisterResult`
- `DataKey` (enum)
- `Config`, `Escrow`, `MultiSigEscrow`, `Arbitration` (market)

Storage keys are typed enums (`DataKey`) — no raw string keys are used, preventing
key collision bugs.

---

## 5. Denial of Service

- **`list_workers()`** returns all worker IDs in one call. For large registries this
  could hit Soroban's read-entry limits. Mitigated by `list_workers_paginated(offset, limit)`.
- **`batch_register`** is capped at `MAX_BATCH_SIZE = 20` entries per call.
- **TTL management**: all persistent entries are extended to `TTL_EXTEND_TO` (≈1 year)
  on write, and a public `extend_worker_ttl` function allows anyone to refresh entries
  before they expire.

---

## 6. Upgrade Safety

Both contracts expose an `upgrade(new_wasm_hash)` function gated behind `ROLE_UPGRADER`.
The upgrade replaces the WASM in-place, preserving the contract ID and all storage.

Risks:

- A malicious WASM hash could replace contract logic entirely.
- Mitigation: `ROLE_UPGRADER` should be held by a multisig or governance contract in
  production, not a single EOA.

---

## 7. Contract Migration Pattern

See [§ Migration Pattern](#8-migration-pattern) below.

---

## 8. Migration Pattern

Both contracts implement a `migrate(admin, expected_version)` function for safe
storage-layout upgrades.

### How it works

1. A `SchemaVersion` key is stored in persistent storage. It starts at `1` on first
   `initialize` and is incremented by each successful `migrate` call.
2. `migrate(admin, expected_version)` asserts that the current version equals
   `expected_version`. This prevents:
   - Running the same migration twice (idempotency guard).
   - Running migrations out of order.
3. The function is gated behind `ROLE_ADMIN` + `require_auth()`.
4. After running migration logic, the version is bumped to `expected_version + 1`.

### Example: version 1 → 2

```rust
// In migrate():
if expected_version == 1 {
    // e.g. backfill a new field on all Worker records
    // ... migration logic ...
}
// version is then set to 2
```

### Deployment procedure for an upgrade

```
1. stellar contract install --wasm <new.wasm> --source <admin> --network testnet
   # → outputs <new_wasm_hash>

2. stellar contract invoke --id <contract-id> --source <admin> --network testnet \
   -- upgrade --new_wasm_hash <new_wasm_hash>

3. stellar contract invoke --id <contract-id> --source <admin> --network testnet \
   -- migrate --admin <admin-address> --expected_version <N>
```

Step 3 must be run **once** after each upgrade that changes the storage schema.
Running it again will panic with `"Wrong schema version"`.

---

## 9. Deployment Key Handling

Deployment and administration keys are the highest-value secrets in the system: a
compromised `ROLE_UPGRADER` or `ROLE_ADMIN` key can replace contract logic or drain
escrowed funds. The full deployment walkthrough lives in
[`docs/CONTRACTS.md`](../../docs/CONTRACTS.md); the security-relevant rules are
summarised here.

### 9.1 Key storage

- **Never commit secret keys.** `stellar keys` identities are stored under
  `~/.config/stellar/identity/` (or the path given by `STELLAR_KEYS_DIR`); this
  directory must never be inside the repository or a synced/shared folder.
- **Production keys must be hardware-backed or multisig.** `ROLE_ADMIN`,
  `ROLE_UPGRADER`, `ROLE_PAUSER` and `ROLE_FEE_MANAGER` should be held by a
  multisig account or governance contract (see §6), not a single EOA.
- **Separate keys per environment.** Testnet deployer/admin keys must be distinct
  from mainnet keys, and distinct from the keys used for day-to-day operations.
- **Encrypted backups only.** If a key must be backed up, store it in an encrypted
  vault (e.g. `age`/GPG-encrypted file or a secrets manager), never in plaintext
  notes, chat or CI logs.

### 9.2 Environment variable usage

Scripts under `scripts/` read configuration from the environment rather than
hard-coded values. Typical variables:

| Variable                                         | Purpose                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| `STELLAR_NETWORK`                                | `testnet` or `mainnet` target                     |
| `STELLAR_RPC_URL` / `STELLAR_NETWORK_PASSPHRASE` | RPC endpoint and network passphrase               |
| `STELLAR_SOURCE_ACCOUNT`                         | public key of the deployer/admin identity         |
| `STELLAR_SECRET_KEY`                             | secret key, **only** for ephemeral CI/testnet use |
| `REGISTRY_CONTRACT_ID` / `MARKET_CONTRACT_ID`    | existing contract IDs for upgrades                |

Rules:

- Prefer `stellar keys` identities (which sign via the CLI) over passing
  `STELLAR_SECRET_KEY` directly; the secret-key variable exists only for
  throwaway testnet automation.
- Never `echo` or `set -x` around commands that consume secrets; disable shell
  tracing in any script that handles them.
- CI secrets must be scoped to the testnet environment and masked in logs. Mainnet
  deployments should require manual approval and should not run from CI-held keys.
- `.env` files must be listed in `.gitignore`; only `.env.example` (with empty
  values) is committed.

### 9.3 Rotation

- Rotate any key immediately if it may have been exposed (leaked log, shared
  screen, compromised machine).
- Rotation procedure: grant the new key the relevant role via
  `grant_role`/`add_curator`, verify it can perform the operation, then
  `revoke_role` the old key. For `ROLE_UPGRADER`/`ROLE_ADMIN`, perform the swap
  through the multisig so no single party controls the transition.
- Rotate testnet keys on a regular schedule and before any public demo; testnet
  keys are frequently pasted into issues and should be treated as public.
- After rotation, re-run the post-deployment verification steps in
  `docs/CONTRACTS.md` to confirm the old key no longer has authority.

### 9.4 Rollback authorization

- Rolling back (re-installing a previous WASM and calling `upgrade`) requires
  `ROLE_UPGRADER`; any storage-schema change also requires `ROLE_ADMIN` for
  `migrate`. Both must be satisfied by the multisig/governance holder.
- A rollback must be explicitly approved by the same authority that approved the
  original upgrade; it is not a unilateral operator action.
- Rollback of a schema-changing upgrade is **not** automatic: `migrate` only moves
  forward (`expected_version` must match the current version), so reverting data
  requires a new forward migration. Plan and review the rollback path before
  deploying any schema change.
- Record every upgrade and rollback (WASM hash, version, approver, timestamp) in
  the deployment log described in `docs/CONTRACTS.md`.

---

## 10. Known Limitations / Out of Scope

- **Oracle / price feeds**: not used; no external data dependency.
- **Flash loans**: not applicable (no lending pool).
- **Front-running**: tip amounts are public on-chain; no MEV protection is implemented.
- **Sybil resistance**: curator approval is off-chain; the contract trusts the curator list.
