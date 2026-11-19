#!/usr/bin/env bash
# deploy-registry.sh — Build and deploy the BlueCollar Registry contract.
#
# Usage:
#   ./scripts/deploy-registry.sh --network testnet|mainnet --source <secret-key-or-alias> \
#                                 --admin <admin-address>
#
# Arguments:
#   --network  Target network: "testnet" or "mainnet". Selects the Stellar
#              network passed to the `stellar` CLI (via --network) and the key
#              under which the deployment is recorded in deployments.json.
#   --source   Stellar identity used to sign the deploy and initialize
#              transactions. Prefer a named alias configured with
#              `stellar keys add <alias>` (or `stellar keys generate <alias>`)
#              so the secret key never appears in shell history or process
#              listings. A raw secret key is accepted but discouraged.
#   --admin    Address granted admin rights during `initialize`.
#
# Environment variables:
#   None are required. The script relies on the `stellar` CLI configuration
#   (network passphrases, RPC/Horizon endpoints) and on the key store managed
#   by `stellar keys`. Set STELLAR_NETWORK / STELLAR_RPC_URL etc. through the
#   CLI config rather than exporting secrets in the environment.
#
# Security notes:
#   - Never commit secret keys, seed phrases, or funded key material. Use the
#     `stellar keys` store or a hardware/remote signer; pass only the alias.
#   - Run with `set -euo pipefail` (already enabled) and review the printed
#     contract ID before initializing on mainnet.
#   - deployments.json records only public data (contract ID, admin address,
#     timestamp); it must never contain secret keys.
#
# Outputs the deployed contract ID and appends it to deployments.json.
=======

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/bluecollar_registry.wasm"

NETWORK=""
SOURCE=""
ADMIN=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2 ;;
    --source)  SOURCE="$2";  shift 2 ;;
    --admin)   ADMIN="$2";   shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$NETWORK" || -z "$SOURCE" || -z "$ADMIN" ]]; then
  echo "Usage: $0 --network testnet|mainnet --source <key> --admin <address>" >&2
  exit 1
fi

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  echo "Error: --network must be 'testnet' or 'mainnet'" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo "==> Building registry contract..."
(cd "${CONTRACTS_DIR}" && cargo build --release --target wasm32v1-none \
  --package bluecollar-registry 2>&1)

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------
echo "==> Deploying to ${NETWORK}..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "${WASM_PATH}" \
  --source "${SOURCE}" \
  --network "${NETWORK}")

echo "==> Contract ID: ${CONTRACT_ID}"

# ---------------------------------------------------------------------------
# Initialize
# ---------------------------------------------------------------------------
echo "==> Initializing registry contract..."
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- initialize \
  --admin "${ADMIN}"

# ---------------------------------------------------------------------------
# Persist deployment record
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ ! -f "${DEPLOYMENTS_FILE}" ]]; then
  echo '{}' > "${DEPLOYMENTS_FILE}"
fi

# Use python (available on most systems) to update the JSON safely.
python3 - <<EOF
import json, sys

path = "${DEPLOYMENTS_FILE}"
with open(path) as f:
    data = json.load(f)

data.setdefault("${NETWORK}", {})["registry"] = {
    "contract_id": "${CONTRACT_ID}",
    "admin": "${ADMIN}",
    "deployed_at": "${TIMESTAMP}"
}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Saved to {path}")
EOF

echo "==> Done. Registry contract deployed at ${CONTRACT_ID}"
