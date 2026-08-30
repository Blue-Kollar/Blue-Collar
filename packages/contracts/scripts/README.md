# BlueCollar Contract Deployment Scripts

This directory contains **manual deployment scripts** for the BlueCollar Soroban smart contracts. They are not invoked by CI â€” they are run by an operator when deploying or upgrading a contract on testnet or mainnet.

## Scripts

| Script | Purpose |
|--------|---------|
| `deploy-registry.sh` | Build and deploy the Registry contract |
| `deploy-market.sh` | Build and deploy the Market contract |

---

## Prerequisites

Before running any script, make sure the following are installed and available on your `$PATH`:

| Tool | Install |
|------|---------|
| **Rust** with `wasm32v1-none` target | `rustup target add wasm32v1-none` |
| **Stellar CLI** | `cargo install --locked stellar-cli` |
| **Python 3** | Required for JSON manipulation (`deployments.json` update) |
| **bash** | Scripts use `bash` with `set -euo pipefail` |

---

## `deploy-registry.sh`

Builds the Registry contract WASM, deploys it to Stellar, initialises it with an admin address, and records the deployed contract ID in `deployments.json`.

### Usage

```bash
./scripts/deploy-registry.sh \
  --network testnet|mainnet \
  --source <SECRET_KEY_OR_ALIAS> \
  --admin <ADMIN_STELLAR_ADDRESS>
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--network` | âœ… | Target network: `testnet` or `mainnet` |
| `--source` | âœ… | Stellar secret key or `stellar keys` alias used to sign the deploy transaction |
| `--admin` | âœ… | Stellar address that becomes the contract admin (granted `ROLE_ADMIN` on initialisation) |

### What it does

1. Runs `cargo build --release --target wasm32v1-none --package bluecollar-registry`
2. Deploys the compiled WASM via `stellar contract deploy`
3. Invokes `initialize --admin <ADMIN>` on the newly deployed contract
4. Appends a record to `deployments.json` (creates the file if it doesn't exist)

### Example

```bash
./scripts/deploy-registry.sh \
  --network testnet \
  --source SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --admin GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Output

```
==> Building registry contract...
==> Deploying to testnet...
==> Contract ID: CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
==> Initializing registry contract...
==> Done. Registry contract deployed at CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## `deploy-market.sh`

Builds the Market contract WASM, deploys it to Stellar, initialises it with an admin, a protocol fee, and a fee recipient, and records the deployed contract ID in `deployments.json`.

### Usage

```bash
./scripts/deploy-market.sh \
  --network testnet|mainnet \
  --source <SECRET_KEY_OR_ALIAS> \
  --admin <ADMIN_STELLAR_ADDRESS> \
  --fee-bps <0-500> \
  --fee-recipient <FEE_RECIPIENT_STELLAR_ADDRESS>
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--network` | âœ… | Target network: `testnet` or `mainnet` |
| `--source` | âœ… | Stellar secret key or `stellar keys` alias used to sign the deploy transaction |
| `--admin` | âœ… | Stellar address that becomes the contract admin |
| `--fee-bps` | âœ… | Protocol fee in basis points (0â€“500, i.e. 0%â€“5%). Defaults to `0` if omitted |
| `--fee-recipient` | âœ… | Stellar address that receives collected protocol fees |

### What it does

1. Runs `cargo build --release --target wasm32v1-none --package bluecollar-market`
2. Deploys the compiled WASM via `stellar contract deploy`
3. Invokes `initialize --admin <ADMIN> --fee_bps <FEE_BPS> --fee_recipient <FEE_RECIPIENT>`
4. Appends a record to `deployments.json`

### Example

```bash
./scripts/deploy-market.sh \
  --network testnet \
  --source SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --admin GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --fee-bps 100 \
  --fee-recipient GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
```

### Output

```
==> Building market contract...
==> Deploying to testnet...
==> Contract ID: CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
==> Initializing market contract...
==> Done. Market contract deployed at CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## `deployments.json`

Both scripts write a record to `packages/contracts/deployments.json` after a successful deploy. The file has this structure:

```json
{
  "registry": {
    "testnet": {
      "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "deployed_at": "2026-01-01T00:00:00Z"
    }
  },
  "market": {
    "testnet": {
      "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "deployed_at": "2026-01-01T00:00:00Z"
    }
  }
}
```

Each deployment overwrites the previous record for that contract + network combination. The file is safe to commit â€” it contains only contract IDs and timestamps, no secrets.

---

## CI Integration

These scripts are **not run by CI**. GitHub Actions workflows (`ci.yml`, `api-tests.yml`, etc.) run unit/integration tests via `cargo test` only â€” they do not deploy to any network.

Deployments are a manual operator action, typically performed:
- When a new contract version is ready for testnet review
- Before a mainnet release (following the [Mainnet Launch Checklist](../../docs/MAINNET_LAUNCH_CHECKLIST.md))
- After a contract upgrade (WASM install + `upgrade` invocation)

---

## Security Notes

> âš ï¸ **Never commit your secret key** (`--source`) to version control.

- Use a dedicated deployment key with minimal XLM for fees. Do not reuse your personal wallet.
- On mainnet, prefer using a hardware wallet or `stellar keys` with a local keystore rather than passing the raw secret key on the command line.
- After deploying, transfer the `ROLE_ADMIN` to a multisig or hardware-wallet-controlled address using `grant_role` / `set_admin`.
