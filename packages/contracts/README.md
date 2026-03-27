# BlueCollar Contracts

Soroban smart contracts for the BlueCollar platform, deployed on Stellar.

## Contracts

### Registry (`contracts/registry`)
Manages on-chain worker registrations.

| Function | Description |
|---|---|
| `register(id, owner, name, category)` | Register a new worker (owner auth required) |
| `get_worker(id)` | Fetch a worker by id, returns `Option<Worker>` |
| `toggle(id, caller)` | Flip a worker's `is_active` flag (owner only) |
| `list_workers()` | Return all registered worker ids |

### Market (`contracts/market`)
Handles tips and payment escrow between users and workers.

| Function | Description |
|---|---|
| `initialize(admin, fee_bps, fee_recipient)` | One-time setup; sets protocol fee (max 500 bps / 5%) |
| `tip(from, to, token, amount)` | Send a tip; deducts protocol fee and forwards remainder to worker |
| `update_fee(admin, new_fee_bps)` | Update fee in basis points (admin only, max 500) |
| `create_escrow(id, from, to, token, amount, expiry)` | Lock tokens in escrow until released or expired |
| `release_escrow(id, caller)` | Release funds to worker, deducting protocol fee (sender only) |
| `cancel_escrow(id, caller)` | Refund sender before expiry (sender only) |
| `cancel_expired_escrow(id)` | Refund sender after expiry (permissionless) |
| `get_config()` | Read current fee config |
| `get_escrow(id)` | Read escrow state |

## Makefile

All common operations are available via `make` from `packages/contracts/`.

```
make build          # cargo build --release --target wasm32-unknown-unknown
make test           # cargo test
make fmt            # cargo fmt
make clippy         # cargo clippy -- -D warnings
make deploy-testnet # deploy both contracts to Stellar testnet (requires STELLAR_ACCOUNT)
make clean          # cargo clean
```

### deploy-testnet

Set a funded testnet identity before deploying:

```bash
stellar keys generate --global alice --network testnet --fund
export STELLAR_ACCOUNT=alice
make deploy-testnet
```

## Development

```bash
# Install Rust WASM target
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Run tests
make test

# Build WASM artifacts
make build
```
