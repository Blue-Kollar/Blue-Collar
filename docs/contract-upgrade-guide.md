# Soroban Contract Upgrade Guide

A step-by-step guide for safely upgrading the BlueCollar **Registry** and **Market** contracts deployed on Stellar (Soroban), without losing contract IDs or storage state.

---

## How Soroban Upgrades Work

Soroban supports in-place WASM upgrades via `env.deployer().update_current_contract_wasm(new_wasm_hash)`. This replaces the contract's executable code while preserving:

- The contract ID (address stays the same)
- All instance, persistent, and temporary storage entries
- All existing escrows, worker registrations, and config

The upgrade does **not** automatically migrate storage schemas. If the new WASM reads storage keys or types differently from the old WASM, you must handle migration explicitly (see [Storage Migration](#storage-migration-strategies)).

---

## WASM Build and Installation Process

### Step 1 — Write and test the new contract version

Make your changes in `packages/contracts/contracts/market/src/lib.rs` or `registry/src/lib.rs`. Run tests before building:

```bash
cd packages/contracts
cargo test
```

### Step 2 — Build the release WASM

```bash
make build
# or directly:
cargo build --release --target wasm32-unknown-unknown
```

Output files:
- `target/wasm32-unknown-unknown/release/bluecollar_market.wasm`
- `target/wasm32-unknown-unknown/release/bluecollar_registry.wasm`

### Step 3 — Install the WASM on-chain

`stellar contract install` uploads the WASM bytecode to the network and returns a 32-byte hash. The contract is not yet upgraded at this point — the hash is just registered.

```bash
# Install Market WASM
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_market.wasm \
  --source <ADMIN_IDENTITY> \
  --network testnet

# Install Registry WASM
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_registry.wasm \
  --source <ADMIN_IDENTITY> \
  --network testnet
```

Both commands print a WASM hash. Save them:

```
MARKET_WASM_HASH=<32-byte hex from install output>
REGISTRY_WASM_HASH=<32-byte hex from install output>
```

### Step 4 — Invoke the upgrade function

Call the `upgrade` function on each deployed contract, passing the new WASM hash:

```bash
# Upgrade Market contract
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source <ADMIN_IDENTITY> \
  --network testnet \
  -- upgrade \
  --admin <ADMIN_ADDRESS> \
  --new_wasm_hash $MARKET_WASM_HASH

# Upgrade Registry contract
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <ADMIN_IDENTITY> \
  --network testnet \
  -- upgrade \
  --admin <ADMIN_ADDRESS> \
  --new_wasm_hash $REGISTRY_WASM_HASH
```

### Step 5 — Verify the upgrade

Confirm the new WASM is active by fetching the contract's current WASM hash from the network and comparing it to the installed hash:

```bash
stellar contract info \
  --id <MARKET_CONTRACT_ID> \
  --network testnet
```

The reported WASM hash should match `$MARKET_WASM_HASH`.

---

## Upgrade Authorization Requirements

Both contracts enforce the following authorization chain on `upgrade`:

1. `admin.require_auth()` — Soroban VM verifies the transaction is signed by `admin`.
2. `config.admin == admin` — The contract asserts the passed address matches the stored admin.

If either check fails, the transaction is rejected and no state changes occur.

### Key points

- The `--source` identity in the CLI command must be the keypair corresponding to `<ADMIN_ADDRESS>`.
- If the admin key is a multisig account, all required signers must co-sign the transaction before submission.
- Never share the admin private key. Use a hardware wallet (Ledger) or a Stellar multisig account for mainnet admin keys.

### Verifying admin address before upgrade

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_admin
```

Confirm the returned address matches the identity you intend to use as `--source`.

---

## Pre-Upgrade Testing Checklist

Run through this checklist on **testnet** before upgrading mainnet.

### Code review
- [ ] All changes are reviewed and approved via PR
- [ ] No breaking changes to existing storage key names or types (or migration is planned)
- [ ] New functions do not conflict with existing event topic names
- [ ] `MAX_FEE_BPS` and other constants are unchanged (or intentionally changed)

### Automated tests
- [ ] `cargo test` passes with zero failures
- [ ] `cargo clippy -- -D warnings` passes with zero warnings
- [ ] All existing test cases still pass (no regressions)
- [ ] New functionality has corresponding test coverage

### Testnet dry run
- [ ] WASM built successfully (`make build`)
- [ ] WASM installed on testnet (`stellar contract install`)
- [ ] `upgrade` invoked successfully on testnet contract
- [ ] Post-upgrade smoke tests pass (see below)
- [ ] Existing escrows and worker registrations are still readable after upgrade
- [ ] New functionality works as expected on testnet

### Smoke tests post-upgrade

```bash
# Market: verify config is intact
stellar contract invoke --id <MARKET_CONTRACT_ID> --network testnet -- get_admin
stellar contract invoke --id <MARKET_CONTRACT_ID> --network testnet -- get_fee_bps

# Market: verify existing escrow is still readable
stellar contract invoke --id <MARKET_CONTRACT_ID> --network testnet -- get_escrow --id <KNOWN_ESCROW_ID>

# Registry: verify worker count is unchanged
stellar contract invoke --id <REGISTRY_CONTRACT_ID> --network testnet -- worker_count

# Registry: verify a known worker is still readable
stellar contract invoke --id <REGISTRY_CONTRACT_ID> --network testnet -- get_worker --id <KNOWN_WORKER_ID>
```

---

## Rollback Procedures

Soroban does not support automatic rollback. However, because `stellar contract install` registers WASM hashes permanently on-chain, you can re-upgrade to the previous version at any time.

### Before upgrading — record the current WASM hash

```bash
stellar contract info --id <CONTRACT_ID> --network mainnet
# Save the current wasm_hash value as PREVIOUS_WASM_HASH
```

### If the upgrade causes issues — re-upgrade to the previous WASM

The previous WASM hash is already installed on-chain (it was used before). Simply call `upgrade` again with the old hash:

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source <ADMIN_IDENTITY> \
  --network mainnet \
  -- upgrade \
  --admin <ADMIN_ADDRESS> \
  --new_wasm_hash $PREVIOUS_WASM_HASH
```

### Rollback is not possible if

- The new WASM wrote storage entries in a format incompatible with the old WASM (type mismatch on read will panic).
- The new WASM deleted or migrated storage keys that the old WASM expects.

This is why storage-breaking changes require a migration plan (see below) rather than a simple rollback path.

### Emergency pause

Neither contract currently has a pause mechanism. If a critical bug is found post-upgrade and rollback is not safe, the recommended mitigation is:

1. Immediately upgrade to a patched WASM that rejects all state-changing calls.
2. Communicate the issue to users.
3. Deploy a fixed version once ready.

---

## Storage Migration Strategies

### When is migration needed?

Migration is needed when the new WASM changes:
- A `#[contracttype]` struct by adding, removing, or reordering fields
- A storage key name or type
- The encoding of an existing value

If you only add new functions or change logic without touching stored types, no migration is needed.

### Strategy 1 — Additive changes (safest)

Add new fields to structs with `Option<T>` so old entries remain readable:

```rust
// Old
#[contracttype]
pub struct Worker {
    pub owner: Address,
    pub name: String,
}

// New — additive, backward compatible
#[contracttype]
pub struct Worker {
    pub owner: Address,
    pub name: String,
    pub verified: Option<bool>, // new field, defaults to None on old entries
}
```

Old storage entries deserialize successfully — `verified` will be `None` for existing workers.

### Strategy 2 — Lazy migration

Migrate entries on first access rather than all at once. This avoids a single large migration transaction.

```rust
pub fn get_worker(env: Env, id: Symbol) -> Option<WorkerV2> {
    // Try reading as new type first
    if let Some(w) = env.storage().persistent().get::<_, WorkerV2>(&DataKey::Worker(id.clone())) {
        return Some(w);
    }
    // Fall back to old type and migrate
    if let Some(old) = env.storage().persistent().get::<_, WorkerV1>(&DataKey::Worker(id.clone())) {
        let migrated = WorkerV2 { owner: old.owner, name: old.name, verified: Some(false) };
        env.storage().persistent().set(&DataKey::Worker(id), &migrated);
        return Some(migrated);
    }
    None
}
```

### Strategy 3 — Explicit migration function

Add a one-time `migrate` function to the new WASM that the admin calls after upgrading. Gate it so it can only run once.

```rust
pub fn migrate(env: Env, admin: Address, worker_ids: Vec<Symbol>) {
    admin.require_auth();
    let config: Config = env.storage().instance().get(&DataKey::Config).expect("Not initialized");
    assert!(config.admin == admin, "Unauthorized");
    assert!(!env.storage().instance().has(&DataKey::Migrated), "Already migrated");

    for id in worker_ids.iter() {
        if let Some(old) = env.storage().persistent().get::<_, WorkerV1>(&DataKey::Worker(id.clone())) {
            let new = WorkerV2 { owner: old.owner, name: old.name, verified: Some(false) };
            env.storage().persistent().set(&DataKey::Worker(id), &new);
        }
    }

    env.storage().instance().set(&DataKey::Migrated, &true);
}
```

Call it after upgrading:

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <ADMIN_IDENTITY> \
  --network testnet \
  -- migrate \
  --admin <ADMIN_ADDRESS> \
  --worker_ids '["worker1","worker2","worker3"]'
```

### Strategy 4 — New contract deployment (breaking changes)

For major breaking changes where backward compatibility is not feasible:

1. Deploy a new contract instance with the new WASM.
2. Migrate state off-chain by reading from the old contract and writing to the new one.
3. Update `REGISTRY_CONTRACT_ID` / `MARKET_CONTRACT_ID` in the API `.env`.
4. Keep the old contract read-only for a transition period.
5. Decommission the old contract once all clients have migrated.

---

## Mainnet Upgrade Runbook

```
1. [ ] Merge upgrade PR to main after review
2. [ ] Run full test suite: cargo test
3. [ ] Build release WASM: make build
4. [ ] Record current mainnet WASM hash (rollback reference)
5. [ ] Install new WASM on testnet: stellar contract install --network testnet
6. [ ] Upgrade testnet contract: stellar contract invoke ... upgrade
7. [ ] Run smoke tests on testnet (see checklist above)
8. [ ] Install new WASM on mainnet: stellar contract install --network mainnet
9. [ ] Upgrade mainnet contract: stellar contract invoke ... upgrade
10.[ ] Run smoke tests on mainnet
11.[ ] Update CHANGELOG.md with upgrade details and new WASM hash
12.[ ] Update contract addresses table in packages/contracts/README.md
```
