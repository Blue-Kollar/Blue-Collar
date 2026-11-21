#!/usr/bin/env bash
# deploy-market.sh — Build and deploy the BlueCollar Market contract.
#
# Usage:
#   ./scripts/deploy-market.sh --network testnet|mainnet --source <secret-key-or-alias> \
#                               --admin <admin-address> --fee-bps <0-500> \
#                               --fee-recipient <address>
#
# Arguments:
#   --network        Target network: "testnet" or "mainnet" (required).
#   --source         Stellar CLI source: a secret key or a configured key alias
#                    (required). Prefer an alias backed by the CLI keystore.
#   --admin          Admin address for the initialized contract (required).
#   --fee-bps        Fee in basis points, 0-500 (default: 0).
#   --fee-recipient  Address that receives fees (required).
#
# Environment variables:
#   STELLAR_NETWORK_PASSPHRASE  Optional; the Stellar CLI resolves the network
#                               passphrase from its config for the given name.
#   No secrets are read from or written to this script. Never hardcode secret
#   keys here or commit them to the repository.
#
# Deployer key handling:
#   The deployer key is supplied via --source and is never echoed. If the
#   source is missing or empty the script fails fast before building. Use a
#   dedicated deployer identity with the minimum required privileges, and
#   rotate it after mainnet deployments.
#
# Network selection:
#   --network must be exactly "testnet" or "mainnet"; any other value aborts
#   before any build or deploy step runs.
#
# Outputs:
#   Prints the deployed contract ID and appends/updates the record in
#   deployments.json under the selected network.
#
# Rollback:
#   This script does not delete contracts. To roll back, redeploy the previous
#   WASM version and re-initialize, or restore the prior entry in
#   deployments.json from version control. See the deployment guide.
=======

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/bluecollar_market.wasm"

NETWORK=""
SOURCE=""
ADMIN=""
FEE_BPS="0"
FEE_RECIPIENT=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)       NETWORK="$2";       shift 2 ;;
    --source)        SOURCE="$2";        shift 2 ;;
    --admin)         ADMIN="$2";         shift 2 ;;
    --fee-bps)       FEE_BPS="$2";       shift 2 ;;
    --fee-recipient) FEE_RECIPIENT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$NETWORK" || -z "$SOURCE" || -z "$ADMIN" || -z "$FEE_RECIPIENT" ]]; then
  echo "Usage: $0 --network testnet|mainnet --source <key> --admin <addr> \
--fee-bps <n> --fee-recipient <addr>" >&2
  exit 1
fi

# Fail fast if the deployer key source is empty (no hardcoded secrets).
if [[ -z "${SOURCE// }" ]]; then
  echo "Error: --source must be a non-empty secret key or key alias" >&2
  exit 1
fi

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  echo "Error: --network must be 'testnet' or 'mainnet'" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo "==> Building market contract..."
(cd "${CONTRACTS_DIR}" && cargo build --release --target wasm32v1-none \
  --package bluecollar-market 2>&1)

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
echo "==> Initializing market contract..."
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- initialize \
  --admin "${ADMIN}" \
  --fee_bps "${FEE_BPS}" \
  --fee_recipient "${FEE_RECIPIENT}"

# ---------------------------------------------------------------------------
# Persist deployment record
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ ! -f "${DEPLOYMENTS_FILE}" ]]; then
  echo '{}' > "${DEPLOYMENTS_FILE}"
fi

python3 - <<EOF
import json

path = "${DEPLOYMENTS_FILE}"
with open(path) as f:
    data = json.load(f)

data.setdefault("${NETWORK}", {})["market"] = {
    "contract_id": "${CONTRACT_ID}",
    "admin": "${ADMIN}",
    "fee_bps": ${FEE_BPS},
    "fee_recipient": "${FEE_RECIPIENT}",
    "deployed_at": "${TIMESTAMP}"
}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Saved to {path}")
EOF

echo "==> Done. Market contract deployed at ${CONTRACT_ID}"
