# BlueCollar Soroban Contracts

Two smart contracts deployed on Stellar (Soroban): **Registry** and **Market**.

- **Registry** — manages on-chain worker profiles, curator-gated registration, and worker self-management.
- **Market** — handles direct tips and escrow-based payments between users and workers, with a configurable protocol fee.

---

## Prerequisites

| Tool          | Version | Install                                                           |
| ------------- | ------- | ----------------------------------------------------------------- |
| Rust          | stable  | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | —       | `rustup target add wasm32-unknown-unknown`                        |
| Stellar CLI   | latest  | `cargo install --locked stellar-cli --features opt`               |

Verify your setup:

```bash
rustc --version
stellar --version
```

---

## Build

```bash
# from packages/contracts/
make build
# or directly:
cargo build --release --target wasm32-unknown-unknown
```

Output WASMs:

- `target/wasm32-unknown-unknown/release/bluecollar_registry.wasm`
- `target/wasm32-unknown-unknown/release/bluecollar_market.wasm`

---

## Test

```bash
make test
# or:
cargo test
```

Run a single contract's tests:

```bash
cargo test -p bluecollar-registry
cargo test -p bluecollar-market
```

---

## Lint & Format

```bash
make clippy   # cargo clippy -- -D warnings
make fmt      # cargo fmt
```

---

## Deploy

### Testnet

Set up a funded testnet identity first:

```bash
stellar keys generate --global alice --network testnet
stellar keys fund alice --network testnet
```

Deploy Registry:

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_registry.wasm \
  --source alice \
  --network testnet
```

Deploy Market:

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_market.wasm \
  --source alice \
  --network testnet
```

Or use the Makefile shortcut (requires `STELLAR_ACCOUNT` env var):

```bash
STELLAR_ACCOUNT=alice make deploy-testnet
```

### Mainnet

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_registry.wasm \
  --source <your-mainnet-identity> \
  --network mainnet

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_market.wasm \
  --source <your-mainnet-identity> \
  --network mainnet
```

> After deployment, record the returned contract IDs in the [Contract Addresses](#contract-addresses) section below.

---

## Contract Addresses

| Contract | Testnet | Mainnet |
| -------- | ------- | ------- |
| Registry | `—`     | `—`     |
| Market   | `—`     | `—`     |

---

## Registry Contract

### Overview

Manages worker profiles on-chain. Registration is curator-gated — only addresses approved by the admin can register workers. Workers retain ownership of their own profiles and can toggle, update, or deregister themselves.

### Initialise

#### `initialize(env, admin: Address)`

Sets the contract admin. Must be called once before any other function. Panics if already initialised.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

### Admin Functions

#### `add_curator(env, admin: Address, curator: Address)`

Adds a curator who is permitted to register workers. Idempotent — adding an existing curator is a no-op.

- Access: admin only
- Emits: `CuratorAdded`

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- add_curator \
  --admin <ADMIN_ADDRESS> \
  --curator <CURATOR_ADDRESS>
```

#### `remove_curator(env, admin: Address, curator: Address)`

Removes a curator. Removed curators can no longer register workers.

- Access: admin only
- Emits: `CuratorRemoved`

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- remove_curator \
  --admin <ADMIN_ADDRESS> \
  --curator <CURATOR_ADDRESS>
```

#### `upgrade(env, admin: Address, new_wasm_hash: BytesN<32>)`

Upgrades the contract WASM in-place.

- Access: admin only

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- upgrade \
  --admin <ADMIN_ADDRESS> \
  --new_wasm_hash <32_BYTE_HEX_HASH>
```

### Curator Functions

#### `register(env, id: Symbol, owner: Address, name: String, category: Symbol, location_hash: BytesN<32>, contact_hash: BytesN<32>, curator: Address)`

Registers a new worker on-chain. The worker is set as active by default. The `owner` address is also used as the worker's payment wallet.

- Access: caller must be an approved curator
- Emits: `WorkerRegistered`

| Parameter       | Type         | Description                                      |
| --------------- | ------------ | ------------------------------------------------ |
| `id`            | `Symbol`     | Unique worker identifier (≤ 9 chars)             |
| `owner`         | `Address`    | Wallet address that owns this profile            |
| `name`          | `String`     | Display name                                     |
| `category`      | `Symbol`     | Job category (e.g. `plumber`)                    |
| `location_hash` | `BytesN<32>` | SHA-256(lowercase(city) + ":" + lowercase(iso2)) |
| `contact_hash`  | `BytesN<32>` | SHA-256(lowercase(email) or E.164 phone)         |
| `curator`       | `Address`    | The calling curator's address                    |

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source curator-account \
  --network testnet \
  -- register \
  --id worker1 \
  --owner <OWNER_ADDRESS> \
  --name "Alice Smith" \
  --category plumber \
  --location_hash <32_BYTE_HEX> \
  --contact_hash <32_BYTE_HEX> \
  --curator <CURATOR_ADDRESS>
```

### Worker Owner Functions

#### `toggle(env, id: Symbol, caller: Address)`

Toggles the worker's `is_active` flag. Useful for temporarily hiding a profile.

- Access: worker owner only
- Emits: `WorkerToggled`

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source owner-account \
  --network testnet \
  -- toggle \
  --id worker1 \
  --caller <OWNER_ADDRESS>
```

#### `update(env, id: Symbol, caller: Address, name: String, category: Symbol, location_hash: BytesN<32>, contact_hash: BytesN<32>)`

Updates the worker's display name, category, location hash, and contact hash. Pass existing hash values unchanged if only updating name/category.

- Access: worker owner only
- Emits: `WorkerUpdated`

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source owner-account \
  --network testnet \
  -- update \
  --id worker1 \
  --caller <OWNER_ADDRESS> \
  --name "Alice Johnson" \
  --category electrician \
  --location_hash <32_BYTE_HEX> \
  --contact_hash <32_BYTE_HEX>
```

#### `deregister(env, id: Symbol, caller: Address)`

Permanently removes a worker from the registry and the worker list.

- Access: worker owner only
- Emits: `WorkerDeregistered`

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source owner-account \
  --network testnet \
  -- deregister \
  --id worker1 \
  --caller <OWNER_ADDRESS>
```

### View Functions

#### `get_worker(env, id: Symbol) -> Option<Worker>`

Returns the full worker record, or `None` if not found.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --network testnet \
  -- get_worker \
  --id worker1
```

#### `list_workers(env) -> Vec<Symbol>`

Returns all registered worker IDs. For large registries, prefer `list_workers_paginated`.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --network testnet \
  -- list_workers
```

#### `list_workers_paginated(env, offset: u32, limit: u32) -> Vec<Symbol>`

Returns a page of worker IDs. Returns an empty vec if `offset` >= total count or `limit` is 0.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --network testnet \
  -- list_workers_paginated \
  --offset 0 \
  --limit 20
```

#### `worker_count(env) -> u32`

Returns the total number of registered workers.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --network testnet \
  -- worker_count
```

#### `is_curator(env, addr: Address) -> bool`

Returns `true` if the given address is an approved curator.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --network testnet \
  -- is_curator \
  --addr <ADDRESS>
```

#### `get_admin(env) -> Address`

Returns the admin address.

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --network testnet \
  -- get_admin
```

#### `is_initialized(env) -> bool`

Returns `true` if the contract has been initialised.

### Registry Events

All events are published via `env.events().publish(topics, data)`. Topics are indexed and filterable via Horizon event streaming.

#### CuratorAdded

```
topics: (Symbol("CurAdd"), admin: Address, curator: Address)
data:   ()
```

#### CuratorRemoved

```
topics: (Symbol("CurRem"), admin: Address, curator: Address)
data:   ()
```

#### WorkerToggled

```
topics: (Symbol("WrkTgl"), id: Symbol)
data:   is_active: bool
```

#### WorkerUpdated

```
topics: (Symbol("WrkUpd"), id: Symbol)
data:   (name: String, category: Symbol)
```

#### WorkerDeregistered

```
topics: (Symbol("WrkDrg"), id: Symbol)
data:   caller: Address
```

---

## Market Contract

### Overview

Handles two payment flows between users and workers:

1. **Tip** — immediate token transfer with a protocol fee deducted.
2. **Escrow** — tokens are locked in the contract until the payer releases them, or the payer cancels after the escrow expires.

The protocol fee is set at initialisation (max 5% / 500 bps) and can be updated by the admin.

### Initialise

#### `initialize(env, admin: Address, fee_bps: u32, fee_recipient: Address)`

Sets the admin, protocol fee, and fee recipient. Must be called once. Panics if `fee_bps > 500`.

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --fee_bps 100 \
  --fee_recipient <FEE_RECIPIENT_ADDRESS>
```

### Admin Functions

#### `update_fee(env, admin: Address, new_fee_bps: u32)`

Updates the protocol fee. Capped at 500 bps (5%).

- Access: admin only

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- update_fee \
  --admin <ADMIN_ADDRESS> \
  --new_fee_bps 200
```

### Payment Functions

#### `tip(env, from: Address, to: Address, token_addr: Address, amount: i128)`

Transfers tokens directly from `from` to `to`. Deducts the protocol fee from `amount` and sends it to `fee_recipient`. The worker receives `amount - fee`.

- Access: `from` must authorise
- Emits: `TipSent`

| Parameter    | Type      | Description                                 |
| ------------ | --------- | ------------------------------------------- |
| `from`       | `Address` | Payer's address                             |
| `to`         | `Address` | Worker's address                            |
| `token_addr` | `Address` | SEP-41 token contract address               |
| `amount`     | `i128`    | Total amount (fee deducted before transfer) |

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source payer-account \
  --network testnet \
  -- tip \
  --from <PAYER_ADDRESS> \
  --to <WORKER_ADDRESS> \
  --token_addr <TOKEN_CONTRACT_ADDRESS> \
  --amount 1000000
```

#### `create_escrow(env, id: Symbol, from: Address, to: Address, token_addr: Address, amount: i128, expiry: u64)`

Locks `amount` tokens in the contract. The payer can release or cancel (after expiry). Panics if the escrow ID already exists or `amount <= 0`.

- Access: `from` must authorise
- Emits: `EscrowCreated`

| Parameter    | Type      | Description                                 |
| ------------ | --------- | ------------------------------------------- |
| `id`         | `Symbol`  | Unique escrow identifier                    |
| `from`       | `Address` | Payer's address                             |
| `to`         | `Address` | Worker's address                            |
| `token_addr` | `Address` | SEP-41 token contract address               |
| `amount`     | `i128`    | Amount to lock                              |
| `expiry`     | `u64`     | Unix timestamp after which payer may cancel |

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source payer-account \
  --network testnet \
  -- create_escrow \
  --id job42 \
  --from <PAYER_ADDRESS> \
  --to <WORKER_ADDRESS> \
  --token_addr <TOKEN_CONTRACT_ADDRESS> \
  --amount 5000000 \
  --expiry 1800000000
```

#### `release_escrow(env, id: Symbol, caller: Address)`

Releases locked funds to the worker. Callable by either the payer (`from`) or the worker (`to`). Panics if already released or cancelled.

- Access: `from` or `to`
- Emits: `EscrowReleased`

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source payer-account \
  --network testnet \
  -- release_escrow \
  --id job42 \
  --caller <PAYER_ADDRESS>
```

#### `cancel_escrow(env, id: Symbol, caller: Address)`

Refunds locked funds to the payer. Only callable by `from`, and only after `expiry` has passed. Panics if already released, already cancelled, or not yet expired.

- Access: `from` only, after expiry
- Emits: `EscrowCancelled`

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --source payer-account \
  --network testnet \
  -- cancel_escrow \
  --id job42 \
  --caller <PAYER_ADDRESS>
```

### View Functions

#### `get_escrow(env, id: Symbol) -> Option<Escrow>`

Returns the escrow record, or `None` if not found.

```bash
stellar contract invoke \
  --id <MARKET_CONTRACT_ID> \
  --network testnet \
  -- get_escrow \
  --id job42
```

#### `get_fee_bps(env) -> u32`

Returns the current protocol fee in basis points.

#### `get_fee_recipient(env) -> Address`

Returns the address that receives collected fees.

#### `get_admin(env) -> Address`

Returns the admin address.

### Market Events

#### TipSent

```
topics: (Symbol("TipSent"), from: Address, to: Address)
data:   (token: Address, amount: i128)
```

#### EscrowCreated

```
topics: (Symbol("EscCrt"), id: Symbol, from: Address)
data:   (to: Address, token: Address, amount: i128, expiry: u64)
```

#### EscrowReleased

```
topics: (Symbol("EscRel"), id: Symbol, to: Address)
data:   amount: i128
```

#### EscrowCancelled

```
topics: (Symbol("EscCnl"), id: Symbol, from: Address)
data:   amount: i128
```

---

## Hashing Scheme

The `Worker` struct stores two `BytesN<32>` fields — raw SHA-256 digests. No PII ever touches the chain.

### `location_hash`

```
SHA-256( lowercase(city) + ":" + lowercase(iso2_country_code) )
```

Examples:

```
"london:gb"   → sha256 → 32-byte hex
"lagos:ng"    → sha256 → 32-byte hex
```

### `contact_hash`

```
SHA-256( lowercase(email)  )          # for email contacts
SHA-256( e164_phone_number )          # for phone contacts, e.g. "+447911123456"
```

The off-chain API is responsible for computing these digests before calling `register` or `update`. To verify a worker's location or contact, the verifier independently hashes the claimed value and compares it to the on-chain digest.

### Computing hashes (Node.js example)

```js
import { createHash } from "crypto";

const locationHash = createHash("sha256").update("london:gb").digest("hex"); // pass as BytesN<32> to the contract

const contactHash = createHash("sha256").update("[email]").digest("hex");
```

### Computing hashes (Rust example)

```rust
use sha2::{Digest, Sha256};

let location_hash = Sha256::digest(b"london:gb");
let contact_hash  = Sha256::digest(b"[email]");
```

---

## Notes

- All `Symbol` topic keys are ≤ 9 characters to satisfy Soroban's `symbol_short!` constraint.
- Topics are indexed and filterable by off-chain indexers via Horizon event streaming.
- Storage TTL is extended automatically on write (~1 year, threshold ~6 months) to prevent entry expiry.
- The maximum protocol fee is hard-capped at 500 bps (5%) in the contract — `update_fee` will panic above this.
- Escrow expiry is a Unix timestamp in seconds, compared against `env.ledger().timestamp()`.
