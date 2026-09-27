# Contract Upgrade Guide

This guide covers upgrading the deployed BlueCollar Soroban contracts (Registry and Market) without redeploying — preserving the contract ID and all on-chain storage.

## Prerequisites

- [Rust](https://rustup.rs/) with `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) installed
- A funded account with the `ROLE_UPGRADER` role on the contract you are upgrading

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

---

## Upgrade Process

Both contracts follow the same three-step process: **build → install → execute**.

### Step 1 — Build the new WASM

```bash
# Registry
make build-registry

# Market
make build-market
```

Output files:
- `target/wasm32v1-none/release/bluecollar_registry.wasm`
- `target/wasm32v1-none/release/bluecollar_market.wasm`

### Step 2 — Install the WASM on-chain

`install` uploads the WASM bytecode and returns its hash. The contract is **not** upgraded yet.

```bash
# Registry
stellar contract install \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source <YOUR_SECRET_KEY> \
  --network testnet
# → outputs: <NEW_WASM_HASH>

# Market
stellar contract install \
  --wasm target/wasm32v1-none/release/bluecollar_market.wasm \
  --source <YOUR_SECRET_KEY> \
  --network testnet
# → outputs: <NEW_WASM_HASH>
```

Replace `--network testnet` with `--network mainnet` for production.

### Step 3 — Propose and execute the upgrade (timelock)

The Registry contract uses a **48-hour timelock** (`TIMELOCK_LEDGERS = 34,560` ledgers at ~5 s/ledger). The Market contract supports direct upgrade via `upgrade`.

#### Registry Contract (timelock)

```bash
# 3a. Propose the upgrade (requires ROLE_UPGRADER)
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <UPGRADER_SECRET_KEY> \
  --network testnet \
  -- propose_upgrade \
  --admin <UPGRADER_ADDRESS> \
  --new_wasm_hash <NEW_WASM_HASH>

# 3b. After ~48 hours, execute the upgrade (callable by anyone)
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <ANY_ACCOUNT_SECRET_KEY> \
  --network testnet \
  -- execute_upgrade
```

#### Market Contract (direct)

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source <ADMIN_SECRET_KEY> \
  --network testnet \
  -- upgrade \
  --new_wasm_hash <NEW_WASM_HASH>
```

The `admin` argument must match the signing key (`--source`), as `require_auth()` is enforced on-chain.

---

## Version Verification

Before upgrading, verify the contract exposes version information:

```bash
# Check the event schema version (incremented when events change)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ANY_ACCOUNT_SECRET_KEY> \
  --network testnet \
  -- version
# → Returns 1 for baseline event schema version
```

The `version()` function returns the **event schema version**, which tracks the structure of
emitted events. It is distinct from **storage schema version** (see below), which tracks
the persistent data layout.

## Schema Migration

If the upgrade changes the storage layout, run `migrate` after the WASM is applied.

```bash
# Check current storage schema version
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_SECRET_KEY> \
  --network testnet \
  -- get_schema_version

# Run migration (admin only; expected_version must equal current version)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_SECRET_KEY> \
  --network testnet \
  -- migrate \
  --admin <ADMIN_ADDRESS> \
  --expected_version 1
```

`migrate` is idempotent-safe: it panics with `"Wrong schema version"` if called twice or out of order.

### Version Semantics

- **Event schema version** (`version()`): Bumped when events are added, removed, or renamed. Public API versioning.
- **Storage schema version** (`get_schema_version()`): Bumped when persistent storage layout changes. Requires `migrate()`.
- **WASM version** (deployment tracking): Incremented with each binary deployment.

---

## Cancelling a Pending Upgrade (Registry only)

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <UPGRADER_SECRET_KEY> \
  --network testnet \
  -- cancel_upgrade \
  --admin <UPGRADER_ADDRESS>
```

---

## Checking Upgrade Status (Registry only)

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <ANY_ACCOUNT_SECRET_KEY> \
  --network testnet \
  -- get_pending_upgrade
```

Returns the pending `wasm_hash` and `execute_after_ledger`, or `None` if no upgrade is pending.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Missing role` | Signing key does not hold `ROLE_UPGRADER` | Grant the role via `grant_role` from an admin account |
| `Upgrade already pending` | `propose_upgrade` called twice | Cancel the existing proposal first with `cancel_upgrade`, or wait and execute it |
| `Timelock not expired` | `execute_upgrade` called before 48 hours have elapsed | Check `get_pending_upgrade` for `execute_after_ledger` and wait |
| `No pending upgrade` | `execute_upgrade` or `cancel_upgrade` called with nothing pending | Propose an upgrade first |
| `Not initialized` | Contract has not been initialised | Call `initialize` before any admin operation |
| `Wrong schema version` | `migrate` called with incorrect `expected_version` | Query `get_schema_version` and pass the current version |
| `Contract is paused` | Contract is paused | Unpause via `unpause` (requires `ROLE_PAUSER`) before upgrading |

### Verifying the upgrade succeeded

After `execute_upgrade` (Registry) or `upgrade` (Market), confirm the new WASM is active:

```bash
stellar contract info \
  --id <CONTRACT_ID> \
  --network testnet
```

The reported WASM hash should match `<NEW_WASM_HASH>`.
