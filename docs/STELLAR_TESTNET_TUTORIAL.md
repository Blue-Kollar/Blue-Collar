# Stellar Testnet Setup Tutorial

This guide helps developers set up a Stellar testnet account and interact with BlueCollar Soroban contracts.

## Testnet vs Mainnet

- `testnet` is a public Stellar network for development and experimentation.
- `mainnet` is the real Stellar network with real value.
- Use `testnet` for onboarding, contract deployment, and CLI testing.

## Install the Stellar CLI

Install the Stellar CLI from source:

```bash
cargo install --locked stellar-cli
```

Verify the CLI:

```bash
stellar --help
```

## Create and fund a testnet account

Generate a reusable key alias and fund it with Friendbot:

```bash
cd packages/contracts
stellar keys generate --global deployer
stellar keys fund deployer --network testnet
stellar keys list
```

Copy the public address for the deployer key alias:

```bash
stellar keys address deployer
```

If you need a second account for testing, generate another alias:

```bash
stellar keys generate --global developer
stellar keys fund developer --network testnet
```

## Deploy BlueCollar contracts to testnet

Use the package contract Makefile to build and deploy both contracts:

```bash
cd packages/contracts
make deploy-testnet \
  SOURCE=deployer \
  ADMIN=<your-public-address> \
  FEE_RECIPIENT=<your-public-address> \
  FEE_BPS=100
```

The deployment writes contract IDs to `deployments.json`.

### Manual deploy commands

If you need per-contract deploy control:

```bash
cd packages/contracts
./scripts/deploy-registry.sh \
  --network testnet \
  --source deployer \
  --admin <your-public-address>

./scripts/deploy-market.sh \
  --network testnet \
  --source deployer \
  --admin <your-public-address> \
  --fee-bps 100 \
  --fee-recipient <your-public-address>
```

## Invoke contract functions with Stellar CLI

After deployment, use the contract ID from `deployments.json`.

Example: call the registry contract to register a worker:

```bash
stellar contract invoke \
  --id <registry-contract-id> \
  --source deployer \
  --network testnet \
  -- register \
  --id w1 \
  --owner <your-public-address> \
  --name "Alice" \
  --category plumber
```

Example: upgrade a contract on testnet:

```bash
stellar contract install \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source deployer \
  --network testnet

stellar contract invoke \
  --id <registry-contract-id> \
  --source deployer \
  --network testnet \
  -- upgrade \
  --new_wasm_hash <new-wasm-hash>
```

## Troubleshooting

- If friendbot fails, confirm the network is `testnet`.
- Use `stellar keys list` to verify alias registration.
- If deploy script fails, run `make build` first and ensure the WASM files exist in `target/wasm32v1-none/release/`.

## Next steps

- Use `stellar contract invoke` to call other contract methods.
- Inspect contract logs in the Soroban testnet explorer.
- Add or update contract tests in `packages/contracts/contracts/*/src/test.rs`.
